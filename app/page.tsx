"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getSavedName, saveName } from "@/lib/client";
import { SEED_MEMBERS } from "@/lib/members";
import { MONITOR_NAME } from "@/lib/rules";

export default function EnterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    const saved = getSavedName();
    if (saved) router.replace(saved === MONITOR_NAME ? "/monitor" : "/field");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("이름을 입력해주세요");
      return;
    }
    setBusy(true);
    try {
      const { status, data } = await api<{ ok: boolean; name?: string; monitor?: boolean }>("/api/login", {
        method: "POST",
        body: { name },
      });
      if (status === 200 && data.ok && data.name) {
        saveName(data.name);
        router.replace(data.monitor ? "/monitor" : "/field");
      } else if (status === 404) {
        setError("명단에 없는 이름입니다");
      } else if (status === 0) {
        setError("연결에 실패했어요. 잠시 후 다시 시도해주세요");
      } else {
        setError("일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 pt-16 pb-12">
      <div className="text-center fade-up">
        <div className="mx-auto mb-5 h-24 w-24 rounded-full bg-gradient-to-b from-[#ffe6a8] to-[#e0a53a] shadow-[0_20px_40px_-20px_rgba(185,122,30,0.8)]" />
        <h1 className="text-4xl font-extrabold tracking-tight">밀알</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          한 알의 밀이 땅에 떨어져 죽으면
          <br />
          많은 열매를 맺느니라 — 요한복음 12:24
        </p>
      </div>

      <form onSubmit={submit} className="card w-full p-5 fade-up" style={{ animationDelay: "80ms" }}>
        <label className="block text-sm font-semibold text-[var(--muted)]" htmlFor="name">
          이름
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="명단에 있는 이름을 입력하세요"
          autoComplete="off"
          enterKeyHint="go"
          className="mt-2 w-full rounded-xl border border-[rgba(124,74,45,0.18)] bg-white px-4 py-3 text-base outline-none focus:border-[var(--wheat)] focus:ring-2 focus:ring-[rgba(224,165,58,0.25)]"
        />
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary mt-4 w-full text-base"
          style={{ minHeight: "3rem" }}
        >
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>

      {isDev && (
        <div className="w-full text-center text-xs text-[var(--muted)]">
          <button type="button" onClick={() => setShowList((v) => !v)} className="underline">
            테스트 명단 {showList ? "숨기기" : "보기"}
          </button>
          {showList && (
            <div className="card mt-3 grid grid-cols-3 gap-1 p-3 text-left">
              {SEED_MEMBERS.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setName(m.name)}
                  className="rounded-lg px-2 py-1 hover:bg-[#fff3d6]"
                >
                  {m.name}
                  {m.isAdmin && " ⭐"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
