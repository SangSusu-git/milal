import { STAGE_INFO, nextThreshold } from "@/lib/rules";
import type { Stage } from "@/lib/types";

export default function ProgressCard({
  total,
  stage,
}: {
  total: number;
  stage: Stage;
}) {
  const next = nextThreshold(total);
  return (
    <section className="card p-5">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">{stage}단계</p>
      <h2 className="text-xl font-extrabold">{STAGE_INFO[stage].title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{STAGE_INFO[stage].caption}</p>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {next === null ? "밀알이 결실을 맺었어요 🎉" : `다음 단계까지 ${next - total}점`}
      </p>
    </section>
  );
}
