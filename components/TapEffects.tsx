"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 밭 그림을 탭하면 그 자리에 이펙트가 잠깐 나타났다 사라진다.
 * 구름이 비를 뿌리는 것과 물뿌리개로 물을 주는 것 중 랜덤.
 * 한 번에 하나만 — 재생 중의 탭은 큐에 쌓지 않고 무시하며,
 * 끝나면 다음 탭부터 다시 나타난다.
 * 순수 클라이언트 장식 — 점수와 무관하고 서버 호출도 없다.
 * 부모가 relative여야 하며, 이 오버레이가 탭을 받는다.
 */
type Fx = {
  id: number;
  x: number;
  y: number;
  kind: "cloud" | "can";
  drops: { dx: number; delay: number }[];
};

const LIFETIME_MS = 1400;

export default function TapEffects() {
  const [fx, setFx] = useState<Fx | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  function spawn(e: React.PointerEvent<HTMLDivElement>) {
    if (fx) return; // 재생 중에는 무시 — 끝나면 다시 받는다
    const rect = e.currentTarget.getBoundingClientRect();
    const kind = Math.random() < 0.5 ? "cloud" : "can";
    setFx({
      id: Date.now(),
      kind,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      // 물방울 위치·타이밍을 조금씩 흩뜨려 매번 다르게 보이게.
      // 물뿌리개는 주둥이가 왼쪽 아래를 향하므로 물줄기를 왼쪽으로 치우친다.
      drops: [0, 1, 2].map((i) => ({
        dx:
          kind === "cloud"
            ? -20 + i * 16 + (Math.random() * 10 - 5)
            : -18 + i * 9 + (Math.random() * 8 - 4), // 물뿌리개 주둥이(탭 지점 왼쪽 위) 아래로
        delay: 0.12 + i * 0.14 + Math.random() * 0.08,
      })),
    });
    timerRef.current = setTimeout(() => setFx(null), LIFETIME_MS);
  }

  return (
    <div className="absolute inset-0 select-none" onPointerDown={spawn} aria-hidden="true">
      <style>{`
        .fx-cloud, .fx-can {
          position: absolute;
          font-size: 48px;
          filter: drop-shadow(0 3px 6px rgba(90, 60, 20, 0.28));
        }
        .fx-cloud {
          transform: translate(-50%, -100%);
          animation: fx-cloud 1.35s ease-out forwards;
        }
        @keyframes fx-cloud {
          0% { opacity: 0; transform: translate(-50%, -70%) scale(0.5); }
          18% { opacity: 1; transform: translate(-50%, -105%) scale(1); }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -135%) scale(1.05); }
        }
        .fx-can {
          /* 물뿌리개는 탭 지점의 오른쪽 위에서 기울어져 물을 붓는다 */
          transform: translate(-20%, -100%) rotate(-24deg);
          animation: fx-can 1.35s ease-out forwards;
        }
        @keyframes fx-can {
          0% { opacity: 0; transform: translate(-20%, -70%) rotate(0deg) scale(0.5); }
          18% { opacity: 1; transform: translate(-20%, -105%) rotate(-24deg) scale(1); }
          40% { transform: translate(-20%, -108%) rotate(-30deg) scale(1); }
          75% { opacity: 1; transform: translate(-20%, -105%) rotate(-24deg) scale(1); }
          100% { opacity: 0; transform: translate(-20%, -125%) rotate(-12deg) scale(1.05); }
        }
        .fx-drop {
          position: absolute;
          font-size: 21px;
          opacity: 0;
          animation: fx-drop 0.85s ease-in forwards;
        }
        @keyframes fx-drop {
          0% { opacity: 0; transform: translateY(-14px); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translateY(30px); }
        }
        .fx-spark {
          position: absolute;
          transform: translate(-50%, -50%);
          font-size: 24px;
          opacity: 0;
          animation: fx-spark 0.6s ease-out 0.75s forwards;
        }
        @keyframes fx-spark {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          40% { opacity: 1; transform: translate(-50%, -60%) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -75%) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fx-cloud, .fx-can, .fx-drop, .fx-spark { animation: none; opacity: 0.85; }
        }
      `}</style>
      {fx && (
        <span key={fx.id} className="pointer-events-none absolute" style={{ left: fx.x, top: fx.y }}>
          {fx.kind === "cloud" ? (
            <span className="fx-cloud">☁️</span>
          ) : (
            // 물뿌리개 이모지는 유니코드에 없어 직접 그린다 — 파란 양철 물뿌리개
            <span className="fx-can">
              <svg viewBox="0 0 64 52" width="52" height="42" xmlns="http://www.w3.org/2000/svg">
                <path d="M26 24 L9 11 L4 17 L22 31 Z" fill="#3b82c4" />
                <circle cx="7.5" cy="14" r="6" fill="#2f6ea6" />
                <circle cx="5.5" cy="12" r="1" fill="#bfe0f7" />
                <circle cx="9.5" cy="11.5" r="1" fill="#bfe0f7" />
                <circle cx="7" cy="16.5" r="1" fill="#bfe0f7" />
                <rect x="22" y="16" width="26" height="26" rx="7" fill="#4a94d8" />
                <rect x="26" y="21" width="6" height="17" rx="3" fill="#7ab5e8" opacity="0.8" />
                <path d="M47 22 q13 8 0 17" stroke="#2f6ea6" strokeWidth="4.5" fill="none" strokeLinecap="round" />
                <ellipse cx="35" cy="16" rx="10" ry="3.5" fill="#2f6ea6" />
                <ellipse cx="35" cy="15.4" rx="7" ry="2.2" fill="#1f5580" />
              </svg>
            </span>
          )}
          {fx.drops.map((d, i) => (
            <span key={i} className="fx-drop" style={{ left: d.dx, animationDelay: `${d.delay}s` }}>
              💧
            </span>
          ))}
          <span className="fx-spark">✨</span>
        </span>
      )}
    </div>
  );
}
