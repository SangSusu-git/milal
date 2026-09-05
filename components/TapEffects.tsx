"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 밭 그림을 탭하면 그 자리에 이펙트가 잠깐 나타났다 사라진다.
 * 구름이 비를 뿌리는 것과 물뿌리개로 물을 주는 것 중 랜덤.
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
const MAX_ALIVE = 6; // 연타해도 화면이 이펙트로 뒤덮이지 않게

export default function TapEffects() {
  const [fx, setFx] = useState<Fx[]>([]);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
    };
  }, []);

  function spawn(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    const kind = Math.random() < 0.5 ? "cloud" : "can";
    const next: Fx = {
      id,
      kind,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      // 물방울 위치·타이밍을 조금씩 흩뜨려 매번 다르게 보이게.
      // 물뿌리개는 주둥이가 왼쪽 아래를 향하므로 물줄기를 왼쪽으로 치우친다.
      drops: [0, 1, 2].map((i) => ({
        dx:
          kind === "cloud"
            ? -12 + i * 10 + (Math.random() * 8 - 4)
            : -26 + i * 8 + (Math.random() * 6 - 3),
        delay: 0.12 + i * 0.14 + Math.random() * 0.08,
      })),
    };
    setFx((list) => [...list.slice(-(MAX_ALIVE - 1)), next]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setFx((list) => list.filter((f) => f.id !== id));
    }, LIFETIME_MS);
    timers.current.add(t);
  }

  return (
    <div className="absolute inset-0 select-none" onPointerDown={spawn} aria-hidden="true">
      <style>{`
        .fx-cloud, .fx-can {
          position: absolute;
          font-size: 30px;
          filter: drop-shadow(0 2px 4px rgba(90, 60, 20, 0.25));
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
          font-size: 13px;
          opacity: 0;
          animation: fx-drop 0.85s ease-in forwards;
        }
        @keyframes fx-drop {
          0% { opacity: 0; transform: translateY(-10px); }
          30% { opacity: 1; }
          100% { opacity: 0; transform: translateY(20px); }
        }
        .fx-spark {
          position: absolute;
          transform: translate(-50%, -50%);
          font-size: 15px;
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
      {fx.map((f) => (
        <span key={f.id} className="pointer-events-none absolute" style={{ left: f.x, top: f.y }}>
          {f.kind === "cloud" ? (
            <span className="fx-cloud">☁️</span>
          ) : (
            <span className="fx-can">🚿</span>
          )}
          {f.drops.map((d, i) => (
            <span key={i} className="fx-drop" style={{ left: d.dx, animationDelay: `${d.delay}s` }}>
              💧
            </span>
          ))}
          <span className="fx-spark">✨</span>
        </span>
      ))}
    </div>
  );
}
