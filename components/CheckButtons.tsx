import type { CheckKind } from "@/lib/types";

type Props = {
  bible: boolean;
  resolve: boolean;
  busy: CheckKind | null;
  myPoints: number;
  onCheck: (kind: CheckKind) => void;
};

const ITEMS: { kind: CheckKind; icon: string; label: string }[] = [
  { kind: "bible", icon: "📖", label: "성경 읽었어요" },
  { kind: "resolve", icon: "✅", label: "다짐 지켰어요" },
];

export default function CheckButtons({ bible, resolve, busy, myPoints, onCheck }: Props) {
  const done = { bible, resolve };
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--muted)]">오늘 내 체크</h3>
        <p className="text-xs text-[var(--muted)]">
          내 점수 <span className="text-sm font-extrabold text-[var(--wheat-deep)]">{myPoints}</span>점
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {ITEMS.map(({ kind, icon, label }) => {
          const isDone = done[kind];
          return (
            <button
              key={kind}
              type="button"
              disabled={isDone || busy !== null}
              onClick={() => onCheck(kind)}
              className={`btn flex-col py-4 text-[15px] ${isDone ? "btn-done" : "btn-primary"} ${busy === kind ? "pop" : ""}`}
            >
              <span className="text-2xl">{icon}</span>
              <span>{label}</span>
              <span className="text-xs font-semibold opacity-80">{isDone ? "내일 다시" : "+1"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
