"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { api, clearName, getSavedName } from "@/lib/client";
import { KIND_LABEL } from "@/lib/rules";
import type { CheckKind, MonitorData, RequestKind } from "@/lib/types";

const REFRESH_MS = 30_000;

const subscribe = () => () => {};
const getHydrated = () => true;
const getHydratedServer = () => false;

const KINDS: (CheckKind | RequestKind)[] = ["bible", "resolve", "prayer", "invite_remote", "invite_face"];
const KIND_EMOJI: Record<CheckKind | RequestKind, string> = {
  bible: "📖",
  resolve: "✅",
  prayer: "🙏",
  invite_remote: "💬",
  invite_face: "🤝",
};

/** "2026-09-05" → "9/5 (토)" */
function formatDate(date: string): string {
  const d = new Date(`${date}T12:00:00+09:00`);
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" }).format(d);
  const [, m, day] = date.split("-");
  return `${Number(m)}/${Number(day)} (${weekday})`;
}

export default function MonitorPage() {
  const router = useRouter();
  const name = useSyncExternalStore(subscribe, () => getSavedName(), () => null);
  const hydrated = useSyncExternalStore(subscribe, getHydrated, getHydratedServer);
  const [data, setData] = useState<MonitorData | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<"simple" | "detail">("simple");

  const load = useCallback(async (who: string) => {
    const { status, data: d } = await api<MonitorData>(`/api/monitor?name=${encodeURIComponent(who)}`);
    if (status === 200) {
      setData(d);
      setFailed(false);
    } else if (status === 403) {
      // 일반 구성원 — 밭으로
      router.replace("/field");
    } else {
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    if (!hydrated) return;
    if (!name) {
      router.replace("/");
      return;
    }
    load(name);
    const timer = setInterval(() => load(name), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load(name);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hydrated, name, load, router]);

  function logout() {
    clearName();
    router.replace("/");
  }

  if (!data) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-sm text-[var(--muted)]">
        <p>점수 현황을 불러오는 중…</p>
        {failed && (
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

  const active = data.users.filter((u) => u.entries.length > 0);

  return (
    <main className="flex flex-col gap-4 py-5">
      <header className="flex items-center justify-between px-1">
        <div>
          <p className="text-xs text-[var(--muted)]">{data.today} · 한국시간</p>
          <h1 className="text-lg font-extrabold">점수 모니터링</h1>
        </div>
        <button type="button" onClick={logout} className="text-xs text-[var(--muted)] underline">
          나가기
        </button>
      </header>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm">
          전체 누적 <span className="font-extrabold text-[var(--wheat-deep)]">{data.total}점</span> ·{" "}
          참여 기록 {active.length}명
        </p>
        <div className="flex rounded-full border border-[rgba(124,74,45,0.18)] bg-white p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setView("simple")}
            className={`rounded-full px-3 py-1.5 ${view === "simple" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}
          >
            간략히
          </button>
          <button
            type="button"
            onClick={() => setView("detail")}
            className={`rounded-full px-3 py-1.5 ${view === "detail" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}
          >
            자세히
          </button>
        </div>
      </div>

      {view === "simple" ? (
        <>
          <section className="card p-4">
            <h2 className="text-sm font-bold">사용자별 합계</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(124,74,45,0.12)] text-xs text-[var(--muted)]">
                    <th className="pb-2 pr-2 text-left font-semibold">사용자</th>
                    {KINDS.map((k) => (
                      <th key={k} className="pb-2 px-1 text-center font-semibold" title={KIND_LABEL[k]}>
                        {KIND_EMOJI[k]}
                      </th>
                    ))}
                    <th className="pb-2 pl-2 text-right font-semibold">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.name} className="border-b border-[rgba(124,74,45,0.06)] last:border-0">
                      <td className="py-2 pr-2 font-medium">{u.name}</td>
                      {KINDS.map((k) => (
                        <td
                          key={k}
                          className={`px-1 py-2 text-center tabular-nums ${u.byKind[k] === 0 ? "text-[rgba(124,74,45,0.25)]" : ""}`}
                        >
                          {u.byKind[k]}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right font-bold tabular-nums text-[var(--wheat-deep)]">
                        {u.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              📖 성경읽기 · ✅ 다짐 지키기 · 🙏 기도부탁 · 💬 비대면 권유 · 🤝 대면 권유
            </p>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-bold">날짜별 획득</h2>
            {data.days.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">아직 기록이 없어요</p>
            ) : (
              <ul className="mt-2 divide-y divide-[rgba(124,74,45,0.06)]">
                {data.days.map((d) => (
                  <li key={d.date} className="flex items-center justify-between py-2 text-sm">
                    <span>{formatDate(d.date)}</span>
                    <span className="text-xs text-[var(--muted)]">{d.people}명 참여</span>
                    <span className="font-bold tabular-nums text-[var(--wheat-deep)]">+{d.points}점</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-2">
          {active.length === 0 && (
            <p className="card p-4 text-sm text-[var(--muted)]">아직 기록이 없어요</p>
          )}
          {active.map((u) => (
            <details key={u.name} className="card p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-semibold">{u.name}</span>
                <span className="font-bold tabular-nums text-[var(--wheat-deep)]">{u.total}점</span>
              </summary>
              <ul className="divide-y divide-[rgba(124,74,45,0.06)] border-t border-[rgba(124,74,45,0.1)] px-4">
                {u.entries.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 py-2 text-sm">
                    <span className="w-16 shrink-0 text-xs text-[var(--muted)]">{formatDate(e.date)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {KIND_EMOJI[e.kind]} {KIND_LABEL[e.kind]}
                      {e.target && <span className="text-[var(--muted)]"> → {e.target}</span>}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--wheat-deep)]">
                      +{e.points}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
          <p className="px-1 pt-1 text-xs text-[var(--muted)]">이름을 누르면 상세 기록이 열려요</p>
        </section>
      )}
    </main>
  );
}
