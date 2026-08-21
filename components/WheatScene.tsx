import type { Stage } from "@/lib/types";

type Palette = {
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunGlow: string;
  hillFar: string;
  hillNear: string;
  ground: string;
};

const PALETTE: Record<Stage, Palette> = {
  1: { skyTop: "#cfe6ff", skyBottom: "#fff3cf", sun: "#ffd34d", sunGlow: "#fff0b3", hillFar: "#d9c39a", hillNear: "#c9a877", ground: "#c79a63" },
  2: { skyTop: "#bfdcff", skyBottom: "#eaf4ff", sun: "#ffdb6e", sunGlow: "#fff4c7", hillFar: "#b9c79a", hillNear: "#9db57f", ground: "#8a5a36" },
  3: { skyTop: "#a9d3ff", skyBottom: "#ecf8ff", sun: "#ffe07a", sunGlow: "#fff7d6", hillFar: "#a9cc8c", hillNear: "#86b86c", ground: "#7c4a2d" },
  4: { skyTop: "#8fc4ff", skyBottom: "#e6f5ff", sun: "#ffe58a", sunGlow: "#fff9e0", hillFar: "#93c27a", hillNear: "#6fae5a", ground: "#6f4226" },
  5: { skyTop: "#ff9f6e", skyBottom: "#ffe2a8", sun: "#ffb347", sunGlow: "#ffd89a", hillFar: "#d8a85a", hillNear: "#c28b3a", ground: "#6a3f22" },
};

const SUN_POS: Record<Stage, { cx: number; cy: number; r: number }> = {
  1: { cx: 290, cy: 62, r: 34 },
  2: { cx: 280, cy: 70, r: 28 },
  3: { cx: 270, cy: 64, r: 28 },
  4: { cx: 262, cy: 58, r: 30 },
  5: { cx: 250, cy: 92, r: 40 },
};

function Seed({ x, y, stage, rotate = -18, scale = 1 }: { x: number; y: number; stage: Stage; rotate?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="14" ry="8.5" fill={`url(#seedGrad-${stage})`} stroke="#8c5a1e" strokeWidth="1.2" />
      <path d="M -11 0 Q 0 -4 11 0" stroke="#8c5a1e" strokeWidth="1.1" fill="none" opacity="0.8" />
      <ellipse cx="-4" cy="-3" rx="4" ry="1.6" fill="#ffe7b0" opacity="0.7" />
    </g>
  );
}

function Sprout({ stage }: { stage: Stage }) {
  return (
    <g className="sway">
      <path d="M 180 228 C 180 212, 181 198, 180 182" stroke="#4d9a3e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M 180 204 C 160 200, 150 186, 152 172 C 168 174, 180 188, 180 204 Z" fill={`url(#leafGrad-${stage})`} />
      <path d="M 180 196 C 200 190, 212 176, 210 160 C 194 163, 181 178, 180 196 Z" fill={`url(#leafGrad-${stage})`} />
      <path d="M 180 204 C 168 196, 160 186, 154 174" stroke="#2f7a3a" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 180 196 C 192 188, 202 176, 208 163" stroke="#2f7a3a" strokeWidth="1" fill="none" opacity="0.5" />
    </g>
  );
}

function Stalk({ x, height, golden, stage, delay = 0 }: { x: number; height: number; golden: boolean; stage: Stage; delay?: number }) {
  const top = 228 - height;
  const stem = golden ? "#c9952c" : "#4d9a3e";
  const head = golden ? `url(#grainGold-${stage})` : `url(#grainGreen-${stage})`;
  const awn = golden ? "#b8842a" : "#6fb35c";
  const spikelets = Array.from({ length: 7 }, (_, i) => i);
  return (
    <g className="sway" style={{ animationDelay: `${delay}s` }}>
      <path d={`M ${x} 228 C ${x + 2} ${228 - height * 0.4}, ${x - 2} ${228 - height * 0.7}, ${x} ${top + 36}`} stroke={stem} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d={`M ${x} ${228 - height * 0.45} C ${x - 18} ${228 - height * 0.52}, ${x - 24} ${228 - height * 0.66}, ${x - 20} ${228 - height * 0.76}`} stroke={stem} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d={`M ${x} ${228 - height * 0.3} C ${x + 16} ${228 - height * 0.36}, ${x + 22} ${228 - height * 0.5}, ${x + 18} ${228 - height * 0.6}`} stroke={stem} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {spikelets.map((i) => {
        const y = top + 36 - i * 5.2;
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <g key={i}>
            <ellipse cx={x + side * 5} cy={y} rx="6" ry="3.6" fill={head} transform={`rotate(${side * -28} ${x + side * 5} ${y})`} />
            <path d={`M ${x + side * 8} ${y - 2} L ${x + side * 16} ${y - 14}`} stroke={awn} strokeWidth="0.9" opacity="0.85" />
          </g>
        );
      })}
      <ellipse cx={x} cy={top} rx="5" ry="3.4" fill={head} />
    </g>
  );
}

function Sparkles() {
  const pts = [
    [120, 120, 0], [250, 150, 0.6], [90, 170, 1.2], [300, 190, 0.3], [170, 95, 0.9], [215, 205, 1.5],
  ] as const;
  return (
    <g>
      {pts.map(([x, y, d], i) => (
        <g key={i} className="twinkle" style={{ animationDelay: `${d}s` }}>
          <path d={`M ${x} ${y - 6} L ${x + 1.8} ${y - 1.8} L ${x + 6} ${y} L ${x + 1.8} ${y + 1.8} L ${x} ${y + 6} L ${x - 1.8} ${y + 1.8} L ${x - 6} ${y} L ${x - 1.8} ${y - 1.8} Z`} fill="#fff6d6" />
        </g>
      ))}
    </g>
  );
}

export default function WheatScene({ stage, className }: { stage: Stage; className?: string }) {
  const p = PALETTE[stage];
  const sun = SUN_POS[stage];
  const buried = stage >= 2;

  return (
    <svg
      viewBox="0 0 360 300"
      className={className}
      role="img"
      aria-label={`밀알 ${stage}단계`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <linearGradient id={`sky-${stage}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset="1" stopColor={p.skyBottom} />
        </linearGradient>
        <radialGradient id={`sunGlow-${stage}`}>
          <stop offset="0" stopColor={p.sunGlow} stopOpacity="0.95" />
          <stop offset="1" stopColor={p.sunGlow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`seedGrad-${stage}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3c875" />
          <stop offset="1" stopColor="#b87a24" />
        </linearGradient>
        <linearGradient id={`leafGrad-${stage}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8fd46f" />
          <stop offset="1" stopColor="#3f9a3b" />
        </linearGradient>
        <linearGradient id={`grainGreen-${stage}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b7e39a" />
          <stop offset="1" stopColor="#5ea04e" />
        </linearGradient>
        <linearGradient id={`grainGold-${stage}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe39a" />
          <stop offset="1" stopColor="#d39a2e" />
        </linearGradient>
        <linearGradient id={`soil-${stage}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.ground} />
          <stop offset="1" stopColor="#4e2d17" />
        </linearGradient>
        <clipPath id={`frame-${stage}`}>
          <rect x="0" y="0" width="360" height="300" rx="24" />
        </clipPath>
      </defs>

      <g clipPath={`url(#frame-${stage})`}>
        {/* 하늘 */}
        <rect x="0" y="0" width="360" height="300" fill={`url(#sky-${stage})`} />

        {/* 해 */}
        <circle cx={sun.cx} cy={sun.cy} r={sun.r * 2.6} fill={`url(#sunGlow-${stage})`} />
        {stage === 1 &&
          Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x1 = sun.cx + Math.cos(a) * (sun.r + 8);
            const y1 = sun.cy + Math.sin(a) * (sun.r + 8);
            const x2 = sun.cx + Math.cos(a) * (sun.r + 26);
            const y2 = sun.cy + Math.sin(a) * (sun.r + 26);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.sun} strokeWidth="3" strokeLinecap="round" opacity="0.7" />;
          })}
        <circle cx={sun.cx} cy={sun.cy} r={sun.r} fill={p.sun} />

        {/* 먼 언덕 */}
        <path d="M 0 190 C 60 160, 120 170, 180 180 C 240 190, 300 160, 360 178 L 360 300 L 0 300 Z" fill={p.hillFar} opacity="0.9" />
        {/* 가까운 언덕 */}
        <path d="M 0 214 C 70 196, 140 206, 200 212 C 260 218, 310 200, 360 210 L 360 300 L 0 300 Z" fill={p.hillNear} />

        {/* 땅 — 심긴 이후엔 흙 단면을 보여준다 */}
        {buried ? (
          <>
            <rect x="0" y="228" width="360" height="72" fill={`url(#soil-${stage})`} />
            <path d="M 0 228 C 40 224, 80 232, 120 228 C 160 224, 200 232, 240 228 C 280 224, 320 232, 360 228 L 360 236 L 0 236 Z" fill={p.ground} />
            {[30, 95, 150, 210, 270, 330].map((x, i) => (
              <ellipse key={i} cx={x} cy={250 + (i % 3) * 12} rx="5" ry="2.6" fill="#3e2211" opacity="0.45" />
            ))}
          </>
        ) : (
          <>
            <rect x="0" y="228" width="360" height="72" fill={p.ground} />
            {[[20, 242, 70], [110, 256, 50], [200, 246, 90], [290, 260, 60]].map(([x, y, w], i) => (
              <path key={i} d={`M ${x} ${y} l ${w * 0.35} 4 l ${w * 0.3} -3 l ${w * 0.35} 5`} stroke="#9a6a3c" strokeWidth="1.4" fill="none" opacity="0.8" />
            ))}
          </>
        )}

        {/* 1단계: 땅 위의 씨앗 */}
        {stage === 1 && (
          <>
            <ellipse cx="180" cy="232" rx="18" ry="4" fill="#000" opacity="0.18" />
            <Seed x={180} y={222} stage={stage} />
          </>
        )}

        {/* 2단계: 흙 속에 묻힌 씨앗 */}
        {stage === 2 && (
          <>
            <ellipse cx="180" cy="226" rx="22" ry="5" fill="#5e3a1f" opacity="0.9" />
            <Seed x={180} y={252} stage={stage} rotate={-10} scale={0.95} />
            <circle cx="180" cy="252" r="22" fill="none" stroke="#c7a06f" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
          </>
        )}

        {/* 3단계: 새싹 */}
        {stage === 3 && (
          <>
            <Seed x={180} y={254} stage={stage} rotate={-10} scale={0.8} />
            <path d="M 180 246 C 182 240, 180 234, 180 228" stroke="#e7d9b8" strokeWidth="2" fill="none" opacity="0.8" />
            <Sprout stage={stage} />
          </>
        )}

        {/* 4단계: 자란 밀 (초록) */}
        {stage === 4 && (
          <>
            <Stalk x={150} height={92} golden={false} stage={stage} delay={0.4} />
            <Stalk x={180} height={118} golden={false} stage={stage} />
            <Stalk x={210} height={98} golden={false} stage={stage} delay={0.9} />
          </>
        )}

        {/* 5단계: 결실 (황금) */}
        {stage === 5 && (
          <>
            <Stalk x={120} height={96} golden stage={stage} delay={0.6} />
            <Stalk x={150} height={116} golden stage={stage} delay={0.2} />
            <Stalk x={180} height={134} golden stage={stage} />
            <Stalk x={210} height={118} golden stage={stage} delay={0.8} />
            <Stalk x={240} height={98} golden stage={stage} delay={0.4} />
            <Sparkles />
          </>
        )}
      </g>
    </svg>
  );
}
