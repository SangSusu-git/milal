import type { MemberSummary } from "@/lib/types";

export default function MemberList({ members, me }: { members: MemberSummary[]; me: string }) {
  const sorted = [...members].sort((a, b) => {
    const ad = Number(a.bible) + Number(a.resolve);
    const bd = Number(b.bible) + Number(b.resolve);
    if (bd !== ad) return bd - ad; // 오늘 체크한 사람 먼저
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name, "ko");
  });
  return (
    <section className="card p-5">
      <h3 className="text-sm font-bold text-[var(--muted)]">함께 자라는 사람들</h3>
      <ul className="mt-3 divide-y divide-[rgba(124,74,45,0.08)]">
        {sorted.map((m) => {
          const active = m.bible || m.resolve;
          return (
            <li key={m.name} className={`flex items-center justify-between py-2 ${active ? "" : "opacity-60"}`}>
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${active ? "bg-[var(--leaf)]" : "bg-[#d8cbb8]"}`} />
                <span className={`text-sm ${m.name === me ? "font-bold" : ""}`}>
                  {m.name}
                  {m.name === me && <span className="ml-1 text-xs text-[var(--muted)]">(나)</span>}
                </span>
              </span>
              <span className="flex items-center gap-2 text-sm tabular-nums">
                <span className="w-8 text-center">{m.bible ? "📖" : ""}</span>
                <span className="w-8 text-center">{m.resolve ? "✅" : ""}</span>
                <span className="w-10 text-right font-semibold">{m.points}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
