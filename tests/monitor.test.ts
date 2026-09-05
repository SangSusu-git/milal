import { describe, it, expect, beforeEach } from "vitest";
import type { Store } from "@/lib/store/types";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS } from "@/lib/members";
import { MONITOR_NAME } from "@/lib/rules";
import { addRequest, check, decide, login, monitorData, setTotalDev } from "@/lib/service";

const ADMIN = SEED_MEMBERS.find((m) => m.isAdmin)!.name;
const USER = SEED_MEMBERS.find((m) => !m.isAdmin)!.name;
const OTHER = SEED_MEMBERS.filter((m) => !m.isAdmin)[1].name;

// KST 2026-08-21 10:00
const DAY1 = new Date("2026-08-21T01:00:00Z");
// KST 2026-08-22 00:00
const DAY2 = new Date("2026-08-21T15:00:00Z");

describe("login (모니터링)", () => {
  it("모니터링은 명단에 없어도 monitor 플래그로 로그인된다", async () => {
    const store = createMemoryStore();
    const r = await login(store, ` ${MONITOR_NAME} `);
    expect(r).toEqual({ ok: true, name: MONITOR_NAME, isAdmin: false, monitor: true });
  });
});

describe("monitorData", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("일반 구성원과 모르는 이름은 null", async () => {
    expect(await monitorData(store, USER)).toBeNull();
    expect(await monitorData(store, "홍길동")).toBeNull();
  });

  it("모니터링과 관리자는 볼 수 있다", async () => {
    expect(await monitorData(store, MONITOR_NAME)).not.toBeNull();
    expect(await monitorData(store, ADMIN)).not.toBeNull();
  });

  it("명단 전원이 0점으로도 나오고, 명단에 모니터링은 없다", async () => {
    const d = (await monitorData(store, MONITOR_NAME, DAY1))!;
    expect(d.users).toHaveLength(SEED_MEMBERS.length);
    expect(d.users.every((u) => u.total === 0)).toBe(true);
    expect(d.users.some((u) => u.name === MONITOR_NAME)).toBe(false);
  });

  it("항목별·날짜별·개별 기록을 집계한다", async () => {
    await check(store, USER, "bible", DAY1);
    await check(store, USER, "resolve", DAY1);
    await check(store, USER, "bible", DAY2);
    await addRequest(store, OTHER, "prayer", "친구", DAY1);
    const pending = (await monitorData(store, ADMIN, DAY2))!; // 요청은 승인 전이라 미집계
    expect(pending.total).toBe(3);
    const id = (await import("@/lib/service").then((s) => s.listRequests(store, ADMIN)))![0].id;
    await decide(store, ADMIN, id, true, DAY2);

    const d = (await monitorData(store, MONITOR_NAME, DAY2))!;
    expect(d.total).toBe(6);
    const user = d.users.find((u) => u.name === USER)!;
    expect(user.byKind).toEqual({ bible: 2, resolve: 1, prayer: 0, invite_remote: 0, invite_face: 0 });
    expect(user.total).toBe(3);
    // 최신 날짜부터
    expect(user.days).toEqual([
      { date: "2026-08-22", points: 1 },
      { date: "2026-08-21", points: 2 },
    ]);
    expect(user.entries[0]).toEqual({ date: "2026-08-22", kind: "bible", points: 1, target: undefined });

    const other = d.users.find((u) => u.name === OTHER)!;
    expect(other.byKind.prayer).toBe(3);
    expect(other.entries[0]).toEqual({ date: "2026-08-22", kind: "prayer", points: 3, target: "친구" });

    // 정렬: 총점 내림차순
    expect(d.users[0].total).toBeGreaterThanOrEqual(d.users[1].total);
    // 날짜별 전체
    expect(d.days).toEqual([
      { date: "2026-08-22", points: 4, people: 2 },
      { date: "2026-08-21", points: 2, people: 1 },
    ]);
  });

  it("개발용 조정은 총점에만 반영되고 사용자/날짜 집계에서는 빠진다", async () => {
    await check(store, USER, "bible", DAY1);
    await setTotalDev(store, ADMIN, 500, DAY1);
    const d = (await monitorData(store, MONITOR_NAME, DAY1))!;
    expect(d.total).toBe(500);
    expect(d.users.find((u) => u.name === USER)!.total).toBe(1);
    expect(d.days).toEqual([{ date: "2026-08-21", points: 1, people: 1 }]);
  });

  it("모니터링 이름으로는 체크도 요청도 안 된다", async () => {
    expect(await check(store, MONITOR_NAME, "bible", DAY1)).toEqual({
      ok: false,
      reason: "unknown_member",
    });
    expect(await addRequest(store, MONITOR_NAME, "prayer", "친구", DAY1)).toEqual({
      ok: false,
      reason: "unknown_member",
    });
  });
});
