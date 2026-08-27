import { MAX_POINTS, STAGE_THRESHOLDS, nextThreshold } from "@/lib/rules";

/**
 * 밭 안(삽화 왼쪽)에 얹히는 세로 점수 게이지.
 *
 * 눈금은 0~최대점수 전체가 아니라 **지금 단계 구간만** 보여준다. 예를 들어 13점이면
 * 0~200(씨앗이 땅에 심길 때까지), 250점이면 200~400 구간이다. 다음 변화까지
 * 얼마나 남았는지가 막대 높이로 바로 읽히게 하려는 것.
 *
 * 서버 컴포넌트 — 훅도, 상호작용도 없다.
 */
export default function ScoreGauge({ total, className }: { total: number; className?: string }) {
  const next = nextThreshold(total);
  // 현재 구간의 시작점 = total 이하인 기준점 중 가장 큰 값
  const start = [...STAGE_THRESHOLDS].reverse().find((t) => total >= t) ?? 0;
  const top = next ?? MAX_POINTS;
  const span = Math.max(top - start, 1);
  const pct = next === null ? 100 : Math.min(Math.max((total - start) / span, 0), 1) * 100;

  return (
    <div
      className={`pointer-events-none flex flex-col items-center gap-1.5 rounded-2xl border border-[rgba(124,74,45,0.12)] bg-white/70 px-2 py-2.5 backdrop-blur-sm ${className ?? ""}`}
    >
      <style>{`
        .score-gauge-fill { transition: height 700ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .score-gauge-fill { transition: none; }
        }
      `}</style>

      <p className="text-[13px] font-black leading-none tabular-nums text-[var(--wheat-deep)]">{total}</p>
      {/* 결실(최대 점수 이상)에는 다음 기준점이 없어 위아래 라벨이 같은 숫자로 겹친다 */}
      <p className="text-[9px] leading-none text-[var(--muted)]">{next === null ? "결실" : top}</p>

      <div
        role="progressbar"
        aria-valuemin={start}
        aria-valuemax={top}
        aria-valuenow={Math.min(total, top)}
        aria-label={`${start}점에서 ${top}점까지의 진행도`}
        className="relative w-2 flex-1 overflow-hidden rounded-full bg-[rgba(124,74,45,0.14)]"
      >
        <div
          className="score-gauge-fill absolute bottom-0 left-0 w-full rounded-full bg-gradient-to-t from-[var(--leaf)] via-[var(--wheat)] to-[var(--wheat-deep)]"
          style={{ height: `${pct}%` }}
        />
      </div>

      <p className="text-[9px] leading-none text-[var(--muted)]">{start}</p>
    </div>
  );
}
