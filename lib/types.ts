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
  /** 요청 대상 — 요청자가 직접 입력한 자유 텍스트. 명단과 무관하다. */
  target: string;
  requestedAt: string; // ISO 8601
}

export interface LedgerEntry {
  at: string; // ISO 8601
  name: string;
  kind: LedgerKind;
  points: number;
}

/** 관리자 백업/복원 파일 형식 */
export interface Backup {
  version: 1;
  exportedAt: string; // ISO 8601
  members: Member[];
  requests: PendingRequest[];
  ledger: LedgerEntry[];
  checks: Record<string, Checks>; // 이름 → 체크
}

export interface FieldState {
  today: string;
  total: number;
  stage: Stage;
  me: {
    name: string;
    isAdmin: boolean;
    points: number;
    bible: boolean;
    resolve: boolean;
    pendingCount: number;
  };
  memberCount: number;
  todayCount: number;
}
