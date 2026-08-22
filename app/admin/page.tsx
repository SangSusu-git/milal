"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { api, getSavedName } from "@/lib/client";
import { KIND_LABEL, REQUEST_POINTS } from "@/lib/rules";
import type { FieldState, LedgerEntry, PendingRequest } from "@/lib/types";

const isDev = process.env.NODE_ENV !== "production";

// 저장된 이름은 이 페이지가 살아 있는 동안 바뀌지 않으므로 구독은 no-op이다.
const subscribeToName = () => () => {};

// 하이드레이션 이후에만 true — 서버 스냅샷과 클라이언트 스냅샷을 구분한다.
const getHydrated = () => true;
const getHydratedServer = () => false;

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AdminPage() {
  const router = useRouter();
  const name = useSyncExternalStore(
    subscribeToName,
    () => getSavedName(), // 클라이언트 스냅샷
    () => null // 서버 스냅샷 — SSR/하이드레이션 불일치를 React가 처리한다
  );
  const hydrated = useSyncExternalStore(subscribeToName, getHydrated, getHydratedServer);
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);
  const [state, setState] = useState<FieldState | null>(null);
  const [recent, setRecent] = useState<LedgerEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (who: string) => {
    const [r, s, rec] = await Promise.all([
      api<PendingRequest[]>(`/api/admin/requests?name=${encodeURIComponent(who)}`),
      api<FieldState>(`/api/state?name=${encodeURIComponent(who)}`),
      api<LedgerEntry[]>(`/api/admin/recent?name=${encodeURIComponent(who)}`),
    ]);
    if (r.status === 403 || s.status !== 200 || !s.data.me.isAdmin) {
      router.replace("/field");
      return;
    }
    setRequests(r.data);
    setState(s.data);
    setRecent(rec.status === 200 ? rec.data : []);
  }, [router]);

  useEffect(() => {
    if (!hydrated) return; // 아직 클라이언트 스냅샷 전 — 판단하지 않는다
    if (!name) {
      router.replace("/");
      return;
    }
    (async () => {
      await load(name);
    })();
  }, [hydrated, name, load, router]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 1800);
  }

  async function decideOne(id: string, approve: boolean) {
    if (!name) return;
    setBusyId(id);
    const { status, data } = await api<{ ok: boolean; total?: number }>("/api/admin/decide", {
      method: "POST",
      body: { name, id, approve },
    });
    setBusyId(null);
    if (status === 200) {
      flash(approve ? `승인했어요 · 총점 ${data.total}` : "거절했어요");
    } else if (status === 0) {
      flash("연결에 실패했어요. 잠시 후 다시 시도해주세요");
    } else {
      flash("처리하지 못했어요. 새로고침 후 다시 시도해주세요");
    }
    load(name);
  }

  async function setTotal(total: number) {
    if (!name) return;
    const { status } = await api("/api/dev/set-total", { method: "POST", body: { name, total } });
    if (status === 200) {
      flash(`총점을 ${total}으로 맞췄어요`);
    } else if (status === 0) {
      flash("연결에 실패했어요. 잠시 후 다시 시도해주세요");
    } else {
      flash("조정 실패");
    }
    load(name);
  }

  if (!state || !requests || !recent || !name) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-[var(--muted)]">
        불러오는 중…
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 py-5">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-lg font-extrabold">관리</h1>
        <Link href="/field" className="text-xs text-[var(--muted)] underline">
          밭으로
        </Link>
      </header>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--muted)]">대기 중 요청</h2>
          <span className="text-xs text-[var(--muted)]">{requests.length}건</span>
        </div>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">처리할 요청이 없어요.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold">
                    {r.name} <span className="font-normal text-[var(--muted)]">· {KIND_LABEL[r.kind]}</span>
                    <span className="ml-1 text-xs font-bold text-[var(--wheat-deep)]">+{REQUEST_POINTS[r.kind]}</span>
                  </p>
                  <p className="text-xs text-[var(--muted)]">{fmtTime(r.requestedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => decideOne(r.id, true)}
                    className="btn btn-primary px-3 py-2 text-sm"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => decideOne(r.id, false)}
                    className="btn btn-ghost px-3 py-2 text-sm"
                  >
                    거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-black tabular-nums">{state.total}</p>
            <p className="text-xs text-[var(--muted)]">총점</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums">{state.stage}</p>
            <p className="text-xs text-[var(--muted)]">단계</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums">{state.todayCount}</p>
            <p className="text-xs text-[var(--muted)]">오늘 참여</p>
          </div>
        </div>

        <div className="mt-5 border-t border-[rgba(124,74,45,0.12)] pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--muted)]">최근 반영 기록</h2>
            <span className="text-xs text-[var(--muted)]">{recent.length}건</span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">아직 기록이 없어요.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {recent.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="shrink-0 text-xs text-[var(--muted)]">{fmtTime(entry.at)}</span>
                  <span className="flex-1 truncate text-left">
                    {entry.name} <span className="text-[var(--muted)]">· {KIND_LABEL[entry.kind]}</span>
                  </span>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      entry.points < 0 ? "text-red-600" : "text-[var(--wheat-deep)]"
                    }`}
                  >
                    {entry.points >= 0 ? `+${entry.points}` : entry.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {isDev && (
        <section className="card border-dashed p-5">
          <h2 className="text-sm font-bold text-[var(--muted)]">테스트용 점수 조정 (개발 모드에서만 보임)</h2>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[0, 200, 400, 700, 1000].map((t) => (
              <button key={t} type="button" onClick={() => setTotal(t)} className="btn btn-ghost px-2 py-2 text-sm">
                {t}
              </button>
            ))}
          </div>
        </section>
      )}

      {msg && (
        <div className="fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {msg}
        </div>
      )}
    </main>
  );
}
