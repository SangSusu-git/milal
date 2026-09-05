import { randomUUID } from "node:crypto";
import type { Store } from "./store/types";
import type {
  Backup,
  CheckKind,
  Checks,
  DayCheck,
  FieldState,
  LedgerEntry,
  PendingRequest,
  RequestKind,
} from "./types";
import { ensureMembers, findMember } from "./members";
import {
  CHECK_POINTS,
  MONITOR_NAME,
  REQUEST_POINTS,
  isCheckKind,
  isRequestKind,
  stageOf,
  sumPoints,
  todayKST,
} from "./rules";
import type { MonitorData, MonitorUser } from "./types";

// ── 읽기 헬퍼 ───────────────────────────────────────────────

const EMPTY_DAY: DayCheck = { bible: false, resolve: false };

async function getChecks(store: Store, name: string): Promise<Checks> {
  return (await store.get<Checks>(`checks/${name}`)) ?? {};
}

async function getLedger(store: Store): Promise<LedgerEntry[]> {
  return (await store.get<LedgerEntry[]>("ledger")) ?? [];
}

async function getRequests(store: Store): Promise<PendingRequest[]> {
  return (await store.get<PendingRequest[]>("requests")) ?? [];
}

async function appendLedger(store: Store, entry: LedgerEntry): Promise<LedgerEntry[]> {
  const ledger = await getLedger(store);
  ledger.push(entry);
  await store.set("ledger", ledger);
  return ledger;
}

// ── 로그인 ──────────────────────────────────────────────────

export type LoginResult =
  | { ok: true; name: string; isAdmin: boolean; monitor?: true }
  | { ok: false };

export async function login(store: Store, rawName: string): Promise<LoginResult> {
  // 히든 조회 계정 — 명단보다 먼저 처리해 명단과 무관하게 항상 들어갈 수 있다.
  if (rawName.trim() === MONITOR_NAME) {
    return { ok: true, name: MONITOR_NAME, isAdmin: false, monitor: true };
  }
  const members = await ensureMembers(store);
  const member = findMember(members, rawName);
  if (!member) return { ok: false };
  return { ok: true, name: member.name, isAdmin: member.isAdmin };
}

// ── 상태 조회 ───────────────────────────────────────────────

export async function getState(
  store: Store,
  rawName: string,
  now: Date = new Date()
): Promise<FieldState | null> {
  const members = await ensureMembers(store);
  const me = findMember(members, rawName);
  if (!me) return null;

  const today = todayKST(now);
  const [ledger, requests, myChecks] = await Promise.all([
    getLedger(store),
    getRequests(store),
    getChecks(store, me.name),
  ]);

  const myDay = myChecks[today] ?? EMPTY_DAY;

  const total = sumPoints(ledger);
  const myPoints = ledger
    .filter((entry) => entry.name === me.name)
    .reduce((acc, entry) => acc + entry.points, 0);

  const todayParticipants = new Set<string>();
  for (const entry of ledger) {
    if (entry.kind !== "bible" && entry.kind !== "resolve") continue;
    if (todayKST(new Date(entry.at)) !== today) continue;
    todayParticipants.add(entry.name);
  }

  return {
    today,
    total,
    stage: stageOf(total),
    me: {
      name: me.name,
      isAdmin: me.isAdmin,
      points: myPoints,
      bible: myDay.bible,
      resolve: myDay.resolve,
      pendingCount: requests.filter((r) => r.name === me.name).length,
    },
    memberCount: members.length,
    todayCount: todayParticipants.size,
  };
}

// ── 매일 체크 ───────────────────────────────────────────────

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: "bad_kind" | "unknown_member" | "already" };

export async function check(
  store: Store,
  rawName: string,
  kind: CheckKind,
  now: Date = new Date()
): Promise<CheckResult> {
  if (!isCheckKind(kind)) return { ok: false, reason: "bad_kind" };
  const members = await ensureMembers(store);
  const me = findMember(members, rawName);
  if (!me) return { ok: false, reason: "unknown_member" };

  const today = todayKST(now);
  const checks = await getChecks(store, me.name);
  const day = checks[today] ?? EMPTY_DAY;
  if (day[kind]) return { ok: false, reason: "already" };

  checks[today] = { ...day, [kind]: true };
  await store.set(`checks/${me.name}`, checks);
  await appendLedger(store, {
    at: now.toISOString(),
    name: me.name,
    kind,
    points: CHECK_POINTS,
  });
  return { ok: true };
}

// ── 요청 ────────────────────────────────────────────────

/** 요청 대상 이름의 최대 길이 */
export const REQUEST_TARGET_MAX_LEN = 40;

export type AddRequestResult =
  | { ok: true; pendingCount: number }
  | { ok: false; reason: "bad_kind" | "unknown_member" | "empty_target" | "target_too_long" };

export async function addRequest(
  store: Store,
  rawName: string,
  kind: RequestKind,
  rawTarget: string,
  now: Date = new Date()
): Promise<AddRequestResult> {
  if (!isRequestKind(kind)) return { ok: false, reason: "bad_kind" };
  const members = await ensureMembers(store);
  const me = findMember(members, rawName);
  if (!me) return { ok: false, reason: "unknown_member" };

  // 대상은 자유 텍스트다 — 명단 밖의 사람을 위해 기도하거나 권유할 수도 있으므로
  // 명단과 대조하지 않는다.
  const target = rawTarget.trim();
  if (!target) return { ok: false, reason: "empty_target" };
  if (target.length > REQUEST_TARGET_MAX_LEN) return { ok: false, reason: "target_too_long" };

  const requests = await getRequests(store);
  requests.push({
    id: randomUUID(),
    name: me.name,
    kind,
    target,
    requestedAt: now.toISOString(),
  });
  await store.set("requests", requests);
  return {
    ok: true,
    pendingCount: requests.filter((r) => r.name === me.name).length,
  };
}

async function requireAdmin(store: Store, rawName: string): Promise<string | null> {
  const members = await ensureMembers(store);
  const member = findMember(members, rawName);
  return member?.isAdmin ? member.name : null;
}

/** 관리자가 아니면 null */
export async function listRequests(
  store: Store,
  adminRawName: string
): Promise<PendingRequest[] | null> {
  if (!(await requireAdmin(store, adminRawName))) return null;
  return getRequests(store);
}

export type DecideResult =
  | { ok: true; total: number }
  | { ok: false; reason: "forbidden" | "not_found" };

export async function decide(
  store: Store,
  adminRawName: string,
  id: string,
  approve: boolean,
  now: Date = new Date()
): Promise<DecideResult> {
  if (!(await requireAdmin(store, adminRawName))) return { ok: false, reason: "forbidden" };

  const requests = await getRequests(store);
  const index = requests.findIndex((r) => r.id === id);
  if (index < 0) return { ok: false, reason: "not_found" };

  const [target] = requests.splice(index, 1);
  await store.set("requests", requests);

  let ledger = await getLedger(store);
  if (approve) {
    ledger = await appendLedger(store, {
      at: now.toISOString(),
      name: target.name,
      kind: target.kind,
      points: REQUEST_POINTS[target.kind],
      target: target.target,
    });
  }
  return { ok: true, total: sumPoints(ledger) };
}

/** 최근 반영 기록, 최신순 */
export async function recentLedger(store: Store, limit: number): Promise<LedgerEntry[]> {
  if (limit <= 0) return [];
  const ledger = await getLedger(store);
  return ledger.slice(-limit).reverse();
}

/**
 * 요청 종류별 승인 기록, 각 종류별 최신순.
 * 관리자가 아니면 null.
 */
export async function requestHistory(
  store: Store,
  adminRawName: string
): Promise<Record<RequestKind, LedgerEntry[]> | null> {
  if (!(await requireAdmin(store, adminRawName))) return null;

  const ledger = await getLedger(store);
  const grouped: Record<RequestKind, LedgerEntry[]> = {
    prayer: [],
    invite_remote: [],
    invite_face: [],
  };
  for (const entry of ledger) {
    if (isRequestKind(entry.kind)) grouped[entry.kind].push(entry);
  }
  for (const kind of Object.keys(grouped) as RequestKind[]) {
    grouped[kind].reverse();
  }
  return grouped;
}

// ── 모니터링 ────────────────────────────────────────────────

/**
 * 사용자별·날짜별 점수 현황. "모니터링" 또는 관리자만 볼 수 있다 — 아니면 null.
 * 개발용 조정(adjust)은 사용자/날짜 집계에서 빼고 전체 총점에만 반영한다.
 */
export async function monitorData(
  store: Store,
  rawName: string,
  now: Date = new Date()
): Promise<MonitorData | null> {
  const members = await ensureMembers(store);
  const isMonitor = rawName.trim() === MONITOR_NAME;
  if (!isMonitor && !findMember(members, rawName)?.isAdmin) return null;

  const ledger = await getLedger(store);

  const byName = new Map<string, MonitorUser>();
  for (const m of members) {
    byName.set(m.name, {
      name: m.name,
      byKind: { bible: 0, resolve: 0, prayer: 0, invite_remote: 0, invite_face: 0 },
      total: 0,
      days: [],
      entries: [],
    });
  }

  const userDayPoints = new Map<string, Map<string, number>>(); // 이름 → (날짜 → 점수)
  const allDayPoints = new Map<string, { points: number; people: Set<string> }>();

  for (const entry of ledger) {
    if (entry.kind === "adjust") continue;
    const user = byName.get(entry.name);
    if (!user) continue; // 명단에서 빠진 이름의 기록은 조회 대상이 없다
    const date = todayKST(new Date(entry.at));

    user.byKind[entry.kind] += entry.points;
    user.total += entry.points;
    user.entries.push({ date, kind: entry.kind, points: entry.points, target: entry.target });

    const days = userDayPoints.get(entry.name) ?? new Map<string, number>();
    days.set(date, (days.get(date) ?? 0) + entry.points);
    userDayPoints.set(entry.name, days);

    const all = allDayPoints.get(date) ?? { points: 0, people: new Set<string>() };
    all.points += entry.points;
    all.people.add(entry.name);
    allDayPoints.set(date, all);
  }

  for (const user of byName.values()) {
    user.entries.reverse(); // 장부는 오래된 순이므로 뒤집으면 최신순
    user.days = [...(userDayPoints.get(user.name) ?? new Map<string, number>())]
      .map(([date, points]) => ({ date, points }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  const users = [...byName.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "ko")
  );
  const days = [...allDayPoints]
    .map(([date, v]) => ({ date, points: v.points, people: v.people.size }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return { today: todayKST(now), total: sumPoints(ledger), users, days };
}

// ── 백업/복원 ───────────────────────────────────────────────

/** 관리자가 아니면 null */
export async function exportBackup(store: Store, adminRawName: string): Promise<Backup | null> {
  if (!(await requireAdmin(store, adminRawName))) return null;

  const members = await ensureMembers(store);
  const [requests, ledger] = await Promise.all([getRequests(store), getLedger(store)]);
  const checks: Record<string, Checks> = {};
  await Promise.all(
    members.map(async (m) => {
      checks[m.name] = await getChecks(store, m.name);
    })
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    members,
    requests,
    ledger,
    checks,
  };
}

function isValidBackup(backup: unknown): backup is Backup {
  if (!backup || typeof backup !== "object") return false;
  const b = backup as Record<string, unknown>;
  if (b.version !== 1) return false;
  if (!Array.isArray(b.members) || b.members.length === 0) return false;

  const names = new Set<string>();
  let adminCount = 0;
  for (const m of b.members) {
    if (!m || typeof m !== "object") return false;
    const mm = m as Record<string, unknown>;
    if (typeof mm.name !== "string" || mm.name.trim() === "") return false;
    if (typeof mm.isAdmin !== "boolean") return false;
    if (names.has(mm.name)) return false;
    names.add(mm.name);
    if (mm.isAdmin) adminCount += 1;
  }
  if (adminCount !== 1) return false;

  if (!Array.isArray(b.requests)) return false;
  if (!Array.isArray(b.ledger)) return false;
  if (!b.checks || typeof b.checks !== "object" || Array.isArray(b.checks)) return false;

  return true;
}

export type RestoreResult = { ok: true } | { ok: false; reason: "forbidden" | "invalid" };

/**
 * 백업을 복원한다. 반쯤 복원된 저장소가 실패한 복원보다 더 나쁘므로,
 * 아무것도 쓰기 전에 전체를 먼저 검증한다.
 */
export async function restoreBackup(
  store: Store,
  adminRawName: string,
  backup: unknown
): Promise<RestoreResult> {
  if (!(await requireAdmin(store, adminRawName))) return { ok: false, reason: "forbidden" };
  if (!isValidBackup(backup)) return { ok: false, reason: "invalid" };

  await store.set("members", backup.members);
  await store.set("requests", backup.requests);
  await store.set("ledger", backup.ledger);
  // checks는 새 명단에 있는 이름에 대해서만 복원한다 — 명단에서 빠진 사람의
  // checks 항목은 의도적으로 버린다 (더 이상 조회할 방법이 없으므로 유지할 이유가 없다).
  await Promise.all(
    backup.members.map((m) => store.set(`checks/${m.name}`, backup.checks[m.name] ?? {}))
  );

  return { ok: true };
}

// ── 개발 전용: 단계 확인용 총점 조정 ────────────────────────

export const DEV_ADJUST_NAME = "__dev__";

export type SetTotalResult =
  | { ok: true; total: number }
  | { ok: false; reason: "forbidden" };

export async function setTotalDev(
  store: Store,
  adminRawName: string,
  target: number,
  now: Date = new Date()
): Promise<SetTotalResult> {
  if (!(await requireAdmin(store, adminRawName))) return { ok: false, reason: "forbidden" };
  const current = sumPoints(await getLedger(store));
  const ledger = await appendLedger(store, {
    at: now.toISOString(),
    name: DEV_ADJUST_NAME,
    kind: "adjust",
    points: target - current,
  });
  return { ok: true, total: sumPoints(ledger) };
}
