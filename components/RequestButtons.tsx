import { REQUEST_POINTS } from "@/lib/rules";
import type { RequestKind } from "@/lib/types";

type Props = {
  pendingCount: number;
  busy: RequestKind | null;
  onRequest: (kind: RequestKind) => void;
};

const ITEMS: { kind: RequestKind; icon: string; label: string }[] = [
  { kind: "prayer", icon: "🙏", label: "기도부탁" },
  { kind: "invite_remote", icon: "💬", label: "비대면 권유" },
  { kind: "invite_face", icon: "🤝", label: "대면 권유" },
];

export default function RequestButtons({ pendingCount, busy, onRequest }: Props) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--muted)]">추가 요청</h3>
        {pendingCount > 0 && (
          <span className="rounded-full bg-[#fff3d6] px-2.5 py-0.5 text-xs font-semibold text-[var(--wheat-deep)]">
            대기 중 {pendingCount}건
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ITEMS.map(({ kind, icon, label }) => (
          <button
            key={kind}
            type="button"
            disabled={busy !== null}
            onClick={() => onRequest(kind)}
            className={`btn btn-ghost flex-col px-2 py-3 text-[13px] ${busy === kind ? "pop" : ""}`}
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
            <span className="text-xs font-semibold text-[var(--wheat-deep)]">+{REQUEST_POINTS[kind]}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">관리자 확인 후 점수에 반영됩니다.</p>
    </section>
  );
}
