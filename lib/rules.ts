import type {
  CheckKind,
  LedgerEntry,
  LedgerKind,
  RequestKind,
  Stage,
} from "./types";

export const MAX_POINTS = 700;
export const CHECK_POINTS = 1;

export const REQUEST_POINTS: Record<RequestKind, number> = {
  prayer: 3,
  invite_remote: 5,
  invite_face: 7,
};

/** 각 단계가 시작되는 점수. index 0 → 1단계 */
export const STAGE_THRESHOLDS = [0, 200, 400, 550, 700] as const;

export const STAGE_INFO: Record<Stage, { title: string; caption: string }> = {
  1: { title: "햇빛 아래 씨앗", caption: "아직 땅에 심기지 않은 한 알의 밀" },
  2: { title: "땅에 심긴 씨앗", caption: "어둠 속에서 조용히 기다리는 중" },
  3: { title: "새싹이 돋았어요", caption: "흙을 뚫고 첫 잎이 올라왔어요" },
  4: { title: "자라나는 밀", caption: "푸른 줄기가 하늘을 향해 자라요" },
  5: { title: "결실한 밀", caption: "황금빛으로 여문 열매, 함께 이루었어요" },
};

export const KIND_LABEL: Record<LedgerKind, string> = {
  bible: "성경읽기",
  resolve: "다짐",
  prayer: "기도부탁",
  invite_remote: "비대면 권유",
  invite_face: "대면 권유",
  adjust: "조정",
};

const kstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 한국시간 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayKST(now: Date = new Date()): string {
  return kstFormatter.format(now);
}

export function stageOf(total: number): Stage {
  let stage = 1;
  STAGE_THRESHOLDS.forEach((threshold, index) => {
    if (total >= threshold) stage = index + 1;
  });
  return stage as Stage;
}

/** 다음 단계까지의 기준 점수. 결실(5단계) 이후에는 null */
export function nextThreshold(total: number): number | null {
  for (const threshold of STAGE_THRESHOLDS) {
    if (total < threshold) return threshold;
  }
  return null;
}

export function sumPoints(ledger: LedgerEntry[]): number {
  return ledger.reduce((acc, entry) => acc + entry.points, 0);
}

export function isCheckKind(x: unknown): x is CheckKind {
  return x === "bible" || x === "resolve";
}

export function isRequestKind(x: unknown): x is RequestKind {
  return x === "prayer" || x === "invite_remote" || x === "invite_face";
}
