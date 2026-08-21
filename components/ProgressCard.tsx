import { MAX_POINTS, STAGE_INFO, nextThreshold } from "@/lib/rules";
import type { Stage } from "@/lib/types";

export default function ProgressCard({ total, stage }: { total: number; stage: Stage }) {
  const next = nextThreshold(total);
  const pct = Math.min(100, Math.round((total / MAX_POINTS) * 100));
  return (
    <section className="card p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">{stage}단계</p>
          <h2 className="text-xl font-extrabold">{STAGE_INFO[stage].title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{STAGE_INFO[stage].caption}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black tabular-nums">{total}</p>
          <p className="text-xs text-[var(--muted)]">/ {MAX_POINTS}점</p>
        </div>
      </div>
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[#efe3cf]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8fd46f] via-[#e0a53a] to-[#b97a1e] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {next === null ? "밀알이 결실을 맺었어요 🎉" : `다음 단계까지 ${next - total}점`}
      </p>
    </section>
  );
}
