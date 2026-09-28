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
