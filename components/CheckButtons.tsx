import type { CheckKind } from "@/lib/types";
import { MEETING_POINTS } from "@/lib/rules";

type Props = {
  bible: boolean;
  resolve: boolean;
  meeting: boolean;
  /** 기도모임 버튼을 보여줄지 — 시작일 전에는 숨긴다 */
  meetingOpen: boolean;
  busy: CheckKind | null;
  myPoints: number;
  /** 오늘 체크 한 번당 점수 (이벤트 날에는 1보다 크다) */
  points: number;
  onCheck: (kind: CheckKind) => void;
};

const ITEMS: { kind: CheckKind; icon: string; label: string }[] = [
  { kind: "bible", icon: "📖", label: "성경 읽었어요" },
  { kind: "resolve", icon: "✅", label: "다짐 지켰어요" },
  // 🙏는 기도부탁 요청 버튼이 쓰고 있어 기도모임은 다른 아이콘으로 구분한다
  { kind: "meeting", icon: "🕯️", label: "기도모임 갔어요" },
];

export default function CheckButtons({ bible, resolve, meeting, meetingOpen, busy, myPoints, points, onCheck }: Props) {
  const done = { bible, resolve, meeting };
  const items = meetingOpen ? ITEMS : ITEMS.filter((i) => i.kind !== "meeting");
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--muted)]">오늘 내 체크</h3>
        <p className="text-xs text-[var(--muted)]">
          내 점수 <span className="text-sm font-extrabold text-[var(--wheat-deep)]">{myPoints}</span>점
        </p>
      </div>
      <div className={`mt-3 grid gap-3 ${items.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {items.map(({ kind, icon, label }) => {
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
              <span className="break-keep">{label}</span>
              <span className="text-xs font-semibold opacity-80">{isDone ? "내일 다시" : `+${kind === "meeting" ? MEETING_POINTS : points}`}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
