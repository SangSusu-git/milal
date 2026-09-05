import { STAGE_INFO, nextThreshold } from "@/lib/rules";
import type { Stage } from "@/lib/types";

/** 한 줄짜리 단계 표시 — 체크 버튼이 첫 화면에 보이도록 최대한 낮게 유지한다. */
export default function ProgressCard({
  total,
  stage,
}: {
  total: number;
  stage: Stage;
}) {
  const next = nextThreshold(total);
  return (
    <section className="card flex items-center justify-between gap-2 px-4 py-2.5">
      <p className="min-w-0 truncate text-sm">
        <span className="font-semibold text-[var(--muted)]">{stage}단계</span>
        <span className="mx-1.5 text-[var(--muted)]">·</span>
        <span className="font-extrabold">{STAGE_INFO[stage].title}</span>
      </p>
      <p className="shrink-0 text-xs text-[var(--muted)]">
        {next === null ? "결실을 맺었어요 🎉" : `다음 단계까지 ${next - total}점`}
      </p>
    </section>
  );
}
