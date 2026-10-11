import type {
  CheckKind,
  LedgerEntry,
  LedgerKind,
  RequestKind,
  Stage,
} from "./types";

export const MAX_POINTS = 700;
export const CHECK_POINTS = 1;

/**
 * 날짜(KST, YYYY-MM-DD) 한정 체크 점수 이벤트.
 * 그날의 성경읽기·다짐 체크만 이 점수로 적립된다 — 요청(기도부탁·권유) 점수는 그대로.
 * 날짜가 지나면 자동으로 기본 점수로 돌아오므로 따로 되돌릴 필요가 없다.
 */
export const CHECK_POINT_EVENTS: Record<string, number> = {
  "2026-10-03": 3,
};

/**
 * 그 날짜(KST)의 체크 한 번당 점수.
 * 기도모임은 이벤트 배율을 받지 않고 항상 기본 점수다.
 */
export function checkPointsOn(date: string, kind: CheckKind = "bible"): number {
  if (kind === "meeting") return CHECK_POINTS;
  return CHECK_POINT_EVENTS[date] ?? CHECK_POINTS;
}

/** 기도모임 체크가 열리는 첫 날 (KST). 이 날짜 전에는 버튼도 없고 서버도 거부한다. */
export const MEETING_START_DATE = "2026-10-12";

/** 그 날짜(KST)에 기도모임 체크가 열려 있는지 — 시작일 이후 매일 */
export function isMeetingOpen(date: string): boolean {
  return date >= MEETING_START_DATE; // YYYY-MM-DD는 문자열 비교로 날짜 순서가 맞다
}

/**
 * 히든 조회 전용 이름. 명단에 없고 명단 수에도 안 잡히며,
 * 이 이름으로 들어오면 밭 대신 점수 현황 화면을 본다.
 */
export const MONITOR_NAME = "모니터링";

/** 보너스 장부 항목의 name — 명단에 없는 예약 이름 */
export const BONUS_NAME = "__bonus__";

export const REQUEST_POINTS: Record<RequestKind, number> = {
  prayer: 3,
  invite_remote: 5,
  invite_face: 7,
};

/** 각 단계가 시작되는 점수. index 0 → 1단계 */
export const STAGE_THRESHOLDS = [0, 200, 400, 600, 700] as const;

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
  meeting: "기도모임",
  prayer: "기도부탁",
  invite_remote: "비대면 권유",
  invite_face: "대면 권유",
  bonus: "보너스 점수",
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
  return x === "bible" || x === "resolve" || x === "meeting";
}

export function isRequestKind(x: unknown): x is RequestKind {
  return x === "prayer" || x === "invite_remote" || x === "invite_face";
}
