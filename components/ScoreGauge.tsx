const MAX = 1000;
const TICKS = [0, 200, 400, 700, 1000] as const;

/**
 * 밀알이 자라는 정도를 보여주는 세로 게이지. 삽화 옆에 붙는다.
 * 서버 컴포넌트 — 훅도, 상호작용도 없다.
 */
export default function ScoreGauge({ total, className }: { total: number; className?: string }) {
  const pct = Math.min(Math.max(total / MAX, 0), 1) * 100;

  return (
    // self-stretch로 형제(삽화)와 같은 높이를 갖는다. h-full은 부모 높이가 auto일 때
    // 0으로 계산되어 눈금이 전부 위쪽에 겹치므로 쓰지 않는다.
    <div className={`flex flex-col items-center gap-1 self-stretch py-3 ${className ?? ""}`}>
      <style>{`
        .score-gauge-fill { transition: height 700ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .score-gauge-fill { transition: none; }
        }
      `}</style>
      <p className="text-sm font-black tabular-nums text-[var(--wheat-deep)]">{total}</p>
      {/* 눈금 라벨이 위아래 끝에서 잘리지 않도록 세로 여백을 둔다 */}
      <div className="relative w-full min-h-[9rem] flex-1 py-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={MAX}
          aria-valuenow={total}
          aria-label="밀알 누적 점수"
          className="absolute inset-y-2 left-1/2 w-2.5 -translate-x-1/2 overflow-hidden rounded-full bg-[#efe3cf]"
        >
          <div
            className="score-gauge-fill absolute bottom-0 left-0 w-full rounded-full bg-gradient-to-t from-[var(--leaf)] via-[var(--wheat)] to-[var(--wheat-deep)]"
            style={{ height: `${pct}%` }}
          />
        </div>
        {TICKS.map((value) => (
          <div
            key={value}
            className="absolute left-1/2 flex -translate-x-1/2 translate-y-1/2 flex-col items-center"
            style={{ bottom: `calc(0.5rem + ${(value / MAX) * 100}% - ${((value / MAX) * 100) / 100}rem)` }}
          >
            <span className="h-px w-3.5 bg-[rgba(111,90,73,0.35)]" />
            <span className="mt-0.5 text-[9px] leading-none text-[var(--muted)]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
