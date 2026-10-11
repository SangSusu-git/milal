import { describe, it, expect } from "vitest";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS } from "@/lib/members";
import { MONITOR_NAME, isMeetingOpen } from "@/lib/rules";
import type { Checks } from "@/lib/types";
import { check, exportBackup, getState, monitorData, restoreBackup } from "@/lib/service";

const ADMIN = SEED_MEMBERS.find((m) => m.isAdmin)!.name;
const USER = SEED_MEMBERS.find((m) => !m.isAdmin)!.name;
// KST 2026-10-11 23:59 (시작 전날 끝) / 2026-10-12 00:00 (시작) / 2026-10-13 10:00
const BEFORE = new Date("2026-10-11T14:59:00Z");
const START = new Date("2026-10-11T15:00:00Z");
const LATER = new Date("2026-10-13T01:00:00Z");

describe("기도모임 체크", () => {
  it("시작일 전에는 닫혀 있고 체크가 거부된다", async () => {
    const store = createMemoryStore();
    expect(isMeetingOpen("2026-10-11")).toBe(false);
    expect(await check(store, USER, "meeting", BEFORE)).toEqual({ ok: false, reason: "not_open" });
    const s = (await getState(store, USER, BEFORE))!;
    expect(s.meetingOpen).toBe(false);
    expect(s.total).toBe(0);
  });

  it("시작일 0시부터 +1, 같은 날 두 번째는 already, 다음 날 다시 가능", async () => {
    const store = createMemoryStore();
    expect(await check(store, USER, "meeting", START)).toEqual({ ok: true });
    expect(await check(store, USER, "meeting", START)).toEqual({ ok: false, reason: "already" });
    const s = (await getState(store, USER, START))!;
    expect(s.meetingOpen).toBe(true);
    expect(s.me.meeting).toBe(true);
    expect(s.total).toBe(2);
    expect(await check(store, USER, "meeting", LATER)).toEqual({ ok: true });
    expect((await getState(store, USER, LATER))!.total).toBe(4);
  });

  it("성경·다짐과 독립 — 셋 다 체크하면 하루 +4, 오늘 참여에 센다", async () => {
    const store = createMemoryStore();
    await check(store, USER, "bible", LATER);
    await check(store, USER, "resolve", LATER);
    await check(store, USER, "meeting", LATER);
    const s = (await getState(store, USER, LATER))!;
    expect(s.total).toBe(4);
    expect(s.todayCount).toBe(1);
  });

  it("기도모임만 체크한 사람도 오늘 참여자", async () => {
    const store = createMemoryStore();
    await check(store, USER, "meeting", LATER);
    expect((await getState(store, ADMIN, LATER))!.todayCount).toBe(1);
  });

  it("x3 이벤트 날에도 기도모임은 +2 고정", async () => {
    const store = createMemoryStore();
    const EVENT = new Date("2026-10-03T10:00:00Z"); // 이벤트 날이지만 시작일 전 → 거부
    expect(await check(store, USER, "meeting", EVENT)).toEqual({ ok: false, reason: "not_open" });
    // 시작일 이후 날짜에 이벤트를 흉내: checkPointsOn 자체가 meeting은 항상 1
    const { checkPointsOn } = await import("@/lib/rules");
    expect(checkPointsOn("2026-10-03", "meeting")).toBe(2);
    expect(checkPointsOn("2026-10-03", "bible")).toBe(3);
  });

  it("게스트는 거부", async () => {
    const store = createMemoryStore();
    const backup = (await exportBackup(store, ADMIN))!;
    backup.members = [...backup.members, { name: "게스트", isAdmin: false, isGuest: true }];
    await restoreBackup(store, ADMIN, backup);
    expect(await check(store, "게스트", "meeting", LATER)).toEqual({ ok: false, reason: "guest" });
  });

  it("meeting 키가 없는 옛 checks는 false로 읽힌다", async () => {
    const store = createMemoryStore();
    const old: Checks = { "2026-10-13": { bible: true, resolve: false } };
    await store.set(`checks/${USER}`, old);
    const s = (await getState(store, USER, LATER))!;
    expect(s.me.bible).toBe(true);
    expect(s.me.meeting).toBe(false);
    expect(await check(store, USER, "meeting", LATER)).toEqual({ ok: true });
  });

  it("모니터링 byKind에 meeting이 집계된다", async () => {
    const store = createMemoryStore();
    await check(store, USER, "meeting", LATER);
    const d = (await monitorData(store, MONITOR_NAME, LATER))!;
    const u = d.users.find((x) => x.name === USER)!;
    expect(u.byKind.meeting).toBe(2);
    expect(u.total).toBe(2);
    expect(d.days).toEqual([{ date: "2026-10-13", points: 2, people: 1 }]);
  });
});
