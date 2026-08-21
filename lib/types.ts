export type CheckKind = "bible" | "resolve";
export type RequestKind = "prayer" | "invite_remote" | "invite_face";
/** adjust는 개발용 점수 조정에만 쓰인다. */
export type LedgerKind = CheckKind | RequestKind | "adjust";
export type Stage = 1 | 2 | 3 | 4 | 5;

export interface Member {
  name: string;
  isAdmin: boolean;
}

export interface DayCheck {
  bible: boolean;
  resolve: boolean;
}

/** 날짜(YYYY-MM-DD, KST) → 그날의 체크 */
export type Checks = Record<string, DayCheck>;

export interface PendingRequest {
  id: string;
  name: string;
  kind: RequestKind;
  requestedAt: string; // ISO 8601
}

export interface LedgerEntry {
  at: string; // ISO 8601
  name: string;
  kind: LedgerKind;
  points: number;
}

export interface MemberSummary {
  name: string;
  points: number;
  bible: boolean;
  resolve: boolean;
}

export interface FieldState {
  today: string;
  total: number;
  stage: Stage;
  me: {
    name: string;
    isAdmin: boolean;
    bible: boolean;
    resolve: boolean;
    pendingCount: number;
  };
  members: MemberSummary[];
  todayCount: number;
}
