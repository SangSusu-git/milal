export type CheckKind = "bible" | "resolve";
export type RequestKind = "prayer" | "invite_remote" | "invite_face";
/** adjust는 개발용 점수 조정, bonus는 특별 프로그램 보너스(관리자가 데이터로 넣는다). */
export type LedgerKind = CheckKind | RequestKind | "bonus" | "adjust";
/** 관리자 승인 기록에 종류별로 묶여 보이는 항목 */
export type HistoryKind = RequestKind | "bonus";
export type Stage = 1 | 2 | 3 | 4 | 5;

export interface Member {
  name: string;
  isAdmin: boolean;
  /** 보기 전용 계정 — 점수 체크·요청이 서버에서부터 거부된다. */
  isGuest?: boolean;
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
  /** 요청 승인 항목은 요청 당시의 대상, 보너스 항목은 설명(예: "추석 프로그램 · 1회차"). 일일 체크·조정 항목에는 없다. */
  target?: string;
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

/** 모니터링 화면에서 쓰는, 한 사람의 점수 현황 */
export interface MonitorUser {
  name: string;
  /** 항목별 누적 점수 (adjust 제외) */
  byKind: Record<CheckKind | RequestKind, number>;
  total: number;
  /** 날짜(KST)별 획득 점수, 최신 날짜부터 */
  days: { date: string; points: number }[];
  /** 개별 획득 기록, 최신순 */
  entries: { date: string; kind: CheckKind | RequestKind; points: number; target?: string }[];
}

export interface MonitorData {
  today: string;
  /** 전체 누적 총점 (개발용 조정 포함 — 밭 화면과 같은 값) */
  total: number;
  /** 총점 내림차순, 같으면 이름순. 명단 전원 포함 (0점도) */
  users: MonitorUser[];
  /** 날짜(KST)별 구성원 획득 점수와 참여 인원, 최신 날짜부터. bonus는 그날 들어온 특별 점수 */
  days: { date: string; points: number; people: number; bonus?: number }[];
  /** 특별 보너스 항목, 최신순. 사람에게 배분되지 않고 총점에만 더해진다 */
  bonus: { date: string; label: string; points: number }[];
}

export interface FieldState {
  today: string;
  total: number;
  stage: Stage;
  /** 오늘 체크(성경읽기·다짐) 한 번당 점수 — 평소 1, 이벤트 날에는 더 크다 */
  checkPoints: number;
  me: {
    name: string;
    isAdmin: boolean;
    isGuest: boolean;
    points: number;
    bible: boolean;
    resolve: boolean;
    pendingCount: number;
  };
  memberCount: number;
  todayCount: number;
}
