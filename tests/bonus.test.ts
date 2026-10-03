import { describe, it, expect } from "vitest";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS } from "@/lib/members";
import { MONITOR_NAME, BONUS_NAME } from "@/lib/rules";
import type { LedgerEntry } from "@/lib/types";
import { check, getState, monitorData, requestHistory } from "@/lib/service";

const ADMIN = SEED_MEMBERS.find((m) => m.isAdmin)!.name;
const USER = SEED_MEMBERS.find((m) => !m.isAdmin)!.name;
// KST 2026-09-24 20:00 / 09-25 20:00
const D24 = new Date("2026-09-24T11:00:00Z");
const D25 = new Date("2026-09-25T11:00:00Z");

async function seed() {
  const store = createMemoryStore();
  await check(store, USER, "bible", D24);
  const ledger = (await store.get<LedgerEntry[]>("ledger")) ?? [];
  ledger.push(
    { at: D24.toISOString(), name: BONUS_NAME, kind: "bonus", points: 25, target: "추석 프로그램 · 1회차" },
    { at: D25.toISOString(), name: BONUS_NAME, kind: "bonus", points: 10, target: "추석 프로그램 · 2회차" }
  );
  await store.set("ledger", ledger);
  return store;
}

describe("특별 보너스", () => {
  it("총점에는 더해지고 사람 점수에는 안 들어간다", async () => {
    const store = await seed();
    const s = (await getState(store, USER, D25))!;
    expect(s.total).toBe(36);
    expect(s.me.points).toBe(1);
  });

  it("관리자 승인 기록에 bonus 그룹으로 최신순", async () => {
    const store = await seed();
    const h = (await requestHistory(store, ADMIN))!;
    expect(h.bonus.map((e) => e.points)).toEqual([10, 25]);
    expect(h.bonus[1].target).toBe("추석 프로그램 · 1회차");
    expect(h.prayer).toEqual([]);
  });

  it("모니터링: 별도 bonus 목록 + 날짜별 bonus, 사용자 표에는 없음", async () => {
    const store = await seed();
    const d = (await monitorData(store, MONITOR_NAME, D25))!;
    expect(d.total).toBe(36);
    expect(d.bonus).toEqual([
      { date: "2026-09-25", label: "추석 프로그램 · 2회차", points: 10 },
      { date: "2026-09-24", label: "추석 프로그램 · 1회차", points: 25 },
    ]);
    expect(d.days).toEqual([
      { date: "2026-09-25", points: 0, people: 0, bonus: 10 },
      { date: "2026-09-24", points: 1, people: 1, bonus: 25 },
    ]);
    expect(d.users.some((u) => u.name === BONUS_NAME)).toBe(false);
    expect(d.users.reduce((a, u) => a + u.total, 0)).toBe(1);
  });
});

describe("날짜 한정 체크 점수 이벤트", () => {
  // KST 2026-10-03 23:59 / 2026-10-04 00:00
  const EVENT_LAST = new Date("2026-10-03T14:59:00Z");
  const NEXT_DAY = new Date("2026-10-03T15:00:00Z");

  it("이벤트 날에는 성경·다짐이 +3, 화면용 checkPoints도 3", async () => {
    const store = createMemoryStore();
    await check(store, USER, "bible", EVENT_LAST);
    await check(store, USER, "resolve", EVENT_LAST);
    const s = (await getState(store, USER, EVENT_LAST))!;
    expect(s.total).toBe(6);
    expect(s.checkPoints).toBe(3);
  });

  it("자정(KST)이 지나면 다시 +1", async () => {
    const store = createMemoryStore();
    await check(store, USER, "bible", EVENT_LAST);
    await check(store, USER, "bible", NEXT_DAY);
    const s = (await getState(store, USER, NEXT_DAY))!;
    expect(s.total).toBe(4);
    expect(s.checkPoints).toBe(1);
  });

  it("평소 날짜는 +1", async () => {
    const store = createMemoryStore();
    await check(store, USER, "bible", D24);
    expect((await getState(store, USER, D24))!.checkPoints).toBe(1);
    expect((await getState(store, USER, D24))!.total).toBe(1);
  });
});
