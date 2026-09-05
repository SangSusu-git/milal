"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_POINTS, STAGE_THRESHOLDS, nextThreshold } from "@/lib/rules";

/**
 * 밭 안(삽화 왼쪽)에 얹히는 세로 점수 게이지 — 0부터 최대 점수까지 전체 범위.
 *
 * 위에는 현재 점수만 크게 보여주고, 단계가 바뀌는 지점은 막대 위 눈금선으로
 * 표시한다. 이미 지난 눈금은 옅은 선으로 남고, **다음 목표 눈금만** 그 단계의
 * 이모지와 점수가 붙은 배지로 강조된다. 결실하면 맨 위에 🌾 배지가 남는다.
 *
 * 게이지를 탭하면 숫자가 0부터 현재 점수까지 세어 올라가고 막대도 바닥부터
 * 다시 차오른다 — 순수 장식 리플레이라 점수에는 영향이 없다.
 */

// 각 기준점에 도달하면 되는 단계의 이모지 (200→심긴 씨앗, 400→새싹, 600→자람, 700→결실)
const TICK_EMOJI: Record<number, string> = {
  [STAGE_THRESHOLDS[1]]: "🌰",
  [STAGE_THRESHOLDS[2]]: "🌱",
  [STAGE_THRESHOLDS[3]]: "🌿",
  [STAGE_THRESHOLDS[4]]: "🌾",
};

export default function ScoreGauge({ total, className }: { total: number; className?: string }) {
  // 1이면 평상시(실제 값 그대로). 리플레이 중에는 0→1로 자란다.
  const [progress, setProgress] = useState(1);
  const rafRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  function replay() {
    if (progress < 1) return; // 재생 중에는 무시 — 끝나면 다시 받는다
    const DURATION_MS = 900;
    const startAt = performance.now();
    setProgress(0);
    const tick = (t: number) => {
      const p = Math.min((t - startAt) / DURATION_MS, 1);
      setProgress(1 - Math.pow(1 - p, 3)); // ease-out — 끝에서 부드럽게 멈춘다
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  const next = nextThreshold(total);
  const pct = Math.min(total / MAX_POINTS, 1) * 100;
  const shownTotal = Math.round(total * progress);
  const fillPct = pct * progress;
  const replaying = progress < 1;
  const ticks = STAGE_THRESHOLDS.filter((t) => t > 0);

  return (
    <div
      onPointerDown={replay}
      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-[rgba(124,74,45,0.12)] bg-white/70 px-1.5 py-2.5 backdrop-blur-sm ${className ?? ""}`}
    >
      <style>{`
        .score-gauge-fill { transition: height 700ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .score-gauge-fill { transition: none; }
        }
      `}</style>

      <p className="text-[13px] font-black leading-none tabular-nums text-[var(--wheat-deep)]">{shownTotal}</p>

      <div className="relative w-full flex-1">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={MAX_POINTS}
          aria-valuenow={Math.min(total, MAX_POINTS)}
          aria-label={`0점에서 ${MAX_POINTS}점까지의 진행도`}
          className="absolute bottom-0 left-1/2 top-0 w-2 -translate-x-1/2 overflow-hidden rounded-full bg-[rgba(124,74,45,0.14)]"
        >
          <div
            className="score-gauge-fill absolute bottom-0 left-0 w-full rounded-full bg-gradient-to-t from-[var(--leaf)] via-[var(--wheat)] to-[var(--wheat-deep)]"
            // 리플레이 중에는 rAF가 프레임마다 높이를 주므로 CSS 전환을 꺼서 싸우지 않게 한다
            style={{ height: `${fillPct}%`, transition: replaying ? "none" : undefined }}
          />
        </div>

        {ticks.map((t) => {
          // 결실 후에는 목표가 없으니 맨 위 눈금을 결실 배지로 남긴다
          const isGoal = next === null ? t === MAX_POINTS : t === next;
          return (
            <div
              key={t}
              className="pointer-events-none absolute left-0 right-0"
              style={{ bottom: `${(t / MAX_POINTS) * 100}%` }}
            >
              <div
                className={
                  isGoal
                    ? "h-[2px] w-full rounded bg-[var(--wheat-deep)]"
                    : "h-px w-full bg-[rgba(124,74,45,0.3)]"
                }
              />
              {!isGoal && (
                // 지나온(또는 아직 먼) 눈금에도 어떤 단계였는지 작은 이모지를 남긴다
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full pb-px text-[10px] leading-none opacity-60">
                  {TICK_EMOJI[t]}
                </span>
              )}
              {isGoal && (
                <span className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-full flex-col items-center pb-0.5 leading-none">
                  <span className="text-[12px]">{TICK_EMOJI[t]}</span>
                  <span className="mt-0.5 rounded-full bg-white/85 px-1 text-[8px] font-bold tabular-nums text-[var(--wheat-deep)]">
                    {next === null ? "결실" : t}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[9px] leading-none text-[var(--muted)]">0</p>
    </div>
  );
}
