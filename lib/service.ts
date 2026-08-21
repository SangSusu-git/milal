import { randomUUID } from "node:crypto";
import type { Store } from "./store/types";
import type {
  CheckKind,
  Checks,
  DayCheck,
  FieldState,
  LedgerEntry,
  MemberSummary,
  PendingRequest,
  RequestKind,
} from "./types";
import { ensureMembers, findMember } from "./members";
import {
  CHECK_POINTS,
  REQUEST_POINTS,
  isCheckKind,
  isRequestKind,
  stageOf,
  sumPoints,
  todayKST,
} from "./rules";

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
  | { ok: true; name: string; isAdmin: boolean }
  | { ok: false };

export async function login(store: Store, rawName: string): Promise<LoginResult> {
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
  const [ledger, requests] = await Promise.all([getLedger(store), getRequests(store)]);

  const pointsByName = new Map<string, number>();
  for (const entry of ledger) {
    pointsByName.set(entry.name, (pointsByName.get(entry.name) ?? 0) + entry.points);
  }

  const summaries: MemberSummary[] = await Promise.all(
    members.map(async (m) => {
      const day = (await getChecks(store, m.name))[today] ?? EMPTY_DAY;
      return {
        name: m.name,
        points: pointsByName.get(m.name) ?? 0,
        bible: day.bible,
        resolve: day.resolve,
      };
    })
  );

  const total = sumPoints(ledger);
  const mine = summaries.find((s) => s.name === me.name)!;

  return {
    today,
    total,
    stage: stageOf(total),
    me: {
      name: me.name,
      isAdmin: me.isAdmin,
      bible: mine.bible,
      resolve: mine.resolve,
      pendingCount: requests.filter((r) => r.name === me.name).length,
    },
    members: summaries,
    todayCount: summaries.filter((s) => s.bible || s.resolve).length,
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

export type AddRequestResult =
  | { ok: true; pendingCount: number }
  | { ok: false; reason: "bad_kind" | "unknown_member" };

export async function addRequest(
  store: Store,
  rawName: string,
  kind: RequestKind,
  now: Date = new Date()
): Promise<AddRequestResult> {
  if (!isRequestKind(kind)) return { ok: false, reason: "bad_kind" };
  const members = await ensureMembers(store);
  const me = findMember(members, rawName);
  if (!me) return { ok: false, reason: "unknown_member" };

  const requests = await getRequests(store);
  requests.push({
    id: randomUUID(),
    name: me.name,
    kind,
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
    });
  }
  return { ok: true, total: sumPoints(ledger) };
}

/** 최근 반영 기록, 최신순 */
export async function recentLedger(store: Store, limit: number): Promise<LedgerEntry[]> {
  const ledger = await getLedger(store);
  return ledger.slice(-limit).reverse();
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
