"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import WheatScene from "@/components/WheatScene";
import ScoreGauge from "@/components/ScoreGauge";
import TapEffects from "@/components/TapEffects";
import ProgressCard from "@/components/ProgressCard";
import CheckButtons from "@/components/CheckButtons";
import RequestButtons from "@/components/RequestButtons";
import RequestDialog from "@/components/RequestDialog";
import { api, clearName, getSavedName } from "@/lib/client";
import { MONITOR_NAME } from "@/lib/rules";
import type { CheckKind, FieldState, RequestKind } from "@/lib/types";

// 켜둔 화면은 15초마다, 다른 앱에서 돌아오면 즉시 갱신한다.
// 실제 사용은 "열어서 체크하고 닫는" 패턴이라 돌아올 때 갱신이 체감에 가장 크다.
const REFRESH_MS = 15_000;

// 저장된 이름은 이 페이지가 살아 있는 동안 바뀌지 않으므로 구독은 no-op이다.
const subscribeToName = () => () => {};

// 하이드레이션 이후에만 true — 서버 스냅샷과 클라이언트 스냅샷을 구분한다.
const getHydrated = () => true;
const getHydratedServer = () => false;

export default function FieldPage() {
  const router = useRouter();
  const name = useSyncExternalStore(
    subscribeToName,
    () => getSavedName(), // 클라이언트 스냅샷
    () => null // 서버 스냅샷 — SSR/하이드레이션 불일치를 React가 처리한다
  );
  const hydrated = useSyncExternalStore(subscribeToName, getHydrated, getHydratedServer);
  const [state, setState] = useState<FieldState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busyCheck, setBusyCheck] = useState<CheckKind | null>(null);
  const [busyRequest, setBusyRequest] = useState<RequestKind | null>(null);
  const [requestDialog, setRequestDialog] = useState<RequestKind | null>(null);
  const [floating, setFloating] = useState<{ id: number; text: string } | null>(null);
  const prevStage = useRef<number | null>(null);
  const [stageKey, setStageKey] = useState(0);
  // 해를 탭하면 잠깐 썬글라스를 낀다 — 순수 장식
  const [sunCool, setSunCool] = useState(false);
  const sunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 연속된 새로고침 실패 동안 토스트를 한 번만 띄우기 위한 플래그. 성공하면 초기화된다.
  const toastedForFailureRef = useRef(false);

  const load = useCallback(async (who: string) => {
    const { status, data } = await api<FieldState>(`/api/state?name=${encodeURIComponent(who)}`);
    if (status === 404) {
      clearName();
      router.replace("/");
      return;
    }
    if (status === 200) {
      setState(data);
      setLoadFailed(false);
      toastedForFailureRef.current = false;
      return;
    }
    // 새로고침 실패 — 화면에 있던 좋은 상태를 지우지 않는다
    setLoadFailed(true);
    if (!toastedForFailureRef.current) {
      toastedForFailureRef.current = true;
      if (status === 0) {
        showToast("연결에 실패했어요. 잠시 후 다시 시도해주세요");
      } else {
        showToast("일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요");
      }
    }
  }, [router]);

  useEffect(() => {
    if (!hydrated) return; // 아직 클라이언트 스냅샷 전 — 판단하지 않는다
    if (!name) {
      router.replace("/");
      return;
    }
    if (name === MONITOR_NAME) {
      router.replace("/monitor"); // 히든 조회 계정은 밭이 아니라 현황 화면으로
      return;
    }
    (async () => {
      await load(name);
    })();
    const timer = setInterval(() => load(name), REFRESH_MS);
    // 다른 앱을 보다가 돌아오거나 화면을 다시 켜면 기다리지 않고 바로 갱신한다.
    const onVisible = () => {
      if (document.visibilityState === "visible") load(name);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrated, name, load, router]);

  // 단계가 오르면 장면을 다시 그려 fade-up 애니메이션을 준다
  useEffect(() => {
    if (!state) return;
    if (prevStage.current !== null && state.stage > prevStage.current) {
      setStageKey((k) => k + 1);
      showToast(`${state.stage}단계로 자랐어요! 🌱`);
    }
    prevStage.current = state.stage;
  }, [state]);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }

  function showFloating(text: string) {
    setFloating({ id: Date.now(), text });
    setTimeout(() => setFloating(null), 1100);
  }

  async function onCheck(kind: CheckKind) {
    if (!name) return;
    if (state?.me.isGuest) {
      showToast("게스트는 점수 반영이 안됩니다");
      return;
    }
    setBusyCheck(kind);
    const { status, data } = await api<FieldState | { error: string }>("/api/check", {
      method: "POST",
      body: { name, kind },
    });
    setBusyCheck(null);
    if (status === 200) {
      setState(data as FieldState);
      showFloating("+1");
    } else if (status === 409) {
      showToast("오늘은 이미 체크했어요. 내일 다시!");
      load(name);
    } else if (status === 0) {
      showToast("연결에 실패했어요. 잠시 후 다시 시도해주세요");
    } else {
      showToast("일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요");
    }
  }

  async function onRequestSubmit(kind: RequestKind, target: string) {
    if (!name) return;
    // 게스트는 입력창까지는 열어보되, 보내기에서 안내만 하고 요청하지 않는다
    if (state?.me.isGuest) {
      setRequestDialog(null);
      showToast("게스트는 점수 반영이 안됩니다");
      return;
    }
    setBusyRequest(kind);
    const { status } = await api("/api/request", { method: "POST", body: { name, kind, target } });
    setBusyRequest(null);
    if (status === 200) {
      setRequestDialog(null);
      showToast("요청했어요. 관리자 확인 후 반영됩니다 🙌");
      load(name);
    } else if (status === 0) {
      showToast("연결에 실패했어요. 잠시 후 다시 시도해주세요");
    } else {
      showToast("일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요");
    }
  }

  function onSunTap() {
    if (sunCool) return; // 재생 중에는 무시 — 끝나면 다시 받는다
    setSunCool(true);
    sunTimerRef.current = setTimeout(() => setSunCool(false), 1500);
  }

  function logout() {
    clearName();
    router.replace("/");
  }

  if (!state || !name) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-[var(--muted)]">
        <p>밭으로 가는 중…</p>
        {loadFailed && (
          <>
            <p className="text-xs">불러오지 못했어요. 잠시 후 다시 시도해주세요</p>
            <button
              type="button"
              onClick={() => name && load(name)}
              className="btn btn-ghost px-3 py-1.5 text-sm"
            >
              다시 시도
            </button>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 py-5">
      <header className="flex items-center justify-between px-1">
        <div>
          <p className="text-xs text-[var(--muted)]">
            {state.today} · 한국시간 · {name}님
            {state.me.isAdmin && <span className="ml-1 font-semibold text-[var(--wheat-deep)]">관리자</span>}
            {state.me.isGuest && <span className="ml-1 font-semibold text-[var(--wheat-deep)]">보기 전용</span>}
          </p>
          <h1 className="text-lg font-extrabold">온유부의 밭</h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {state.me.isAdmin && (
            <Link href="/admin" className="rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-white">
              관리
            </Link>
          )}
          <button type="button" onClick={logout} className="text-[var(--muted)] underline">
            나가기
          </button>
        </div>
      </header>

      <section className="card relative overflow-hidden p-0">
        <div key={stageKey} className="fade-up">
          <WheatScene stage={state.stage} cool={sunCool} />
        </div>
        {/* 밭을 탭하면 그 자리에 물 주는 구름 이펙트 — 게이지보다 아래에 둬서 게이지 탭을 안 가로챈다 */}
        <TapEffects onSunTap={onSunTap} />
        {/* 게이지는 밭 안에 얹는다. 해가 오른쪽에 뜨므로 왼쪽에 둔다. */}
        <ScoreGauge total={state.total} className="absolute bottom-3 left-3 top-3 w-11" />
        {floating && (
          <span
            key={floating.id}
            className="float-up pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 text-3xl font-black text-[var(--wheat-deep)] drop-shadow"
          >
            {floating.text}
          </span>
        )}
      </section>

      <ProgressCard total={state.total} stage={state.stage} />

      <CheckButtons
        bible={state.me.bible}
        resolve={state.me.resolve}
        busy={busyCheck}
        myPoints={state.me.points}
        onCheck={onCheck}
      />

      <RequestButtons
        pendingCount={state.me.pendingCount}
        busy={busyRequest}
        onOpen={(kind) => setRequestDialog(kind)}
      />

      <footer className="px-1 pt-2 text-center text-xs text-[var(--muted)]">
        오늘 {state.todayCount}/{state.memberCount}명 참여 · 누적 {state.total}점
      </footer>

      {toast && (
        <div className="fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {requestDialog && (
        <RequestDialog
          kind={requestDialog}
          busy={busyRequest !== null}
          onCancel={() => setRequestDialog(null)}
          onSubmit={(target) => onRequestSubmit(requestDialog, target)}
        />
      )}
    </main>
  );
}
