import { describe, it, expect, beforeEach } from "vitest";
import type { Store } from "@/lib/store/types";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS } from "@/lib/members";
import { getState, check } from "@/lib/service";

const ADMIN = SEED_MEMBERS.find((m) => m.isAdmin)!.name;
const USER = SEED_MEMBERS.find((m) => !m.isAdmin)!.name;
const OTHER = SEED_MEMBERS.filter((m) => !m.isAdmin)[1].name;

// KST 2026-08-21 10:00
const DAY1 = new Date("2026-08-21T01:00:00Z");
// KST 2026-08-21 23:59
const DAY1_LATE = new Date("2026-08-21T14:59:00Z");
// KST 2026-08-22 00:00
const DAY2 = new Date("2026-08-21T15:00:00Z");

describe("getState", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("명단 외 이름은 null", async () => {
    expect(await getState(store, "홍길동", DAY1)).toBeNull();
  });

  it("초기 상태는 0점 1단계, 30명 모두 0점", async () => {
    const s = (await getState(store, USER, DAY1))!;
    expect(s.today).toBe("2026-08-21");
    expect(s.total).toBe(0);
    expect(s.stage).toBe(1);
    expect(s.me).toEqual({ name: USER, isAdmin: false, bible: false, resolve: false, pendingCount: 0 });
    expect(s.members).toHaveLength(30);
    expect(s.members.every((m) => m.points === 0 && !m.bible && !m.resolve)).toBe(true);
    expect(s.todayCount).toBe(0);
  });

  it("관리자는 isAdmin true", async () => {
    expect((await getState(store, ADMIN, DAY1))!.me.isAdmin).toBe(true);
  });
});

describe("check", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("잘못된 종류는 거부", async () => {
    expect(await check(store, USER, "prayer" as never, DAY1)).toEqual({ ok: false, reason: "bad_kind" });
  });

  it("명단 외 이름은 거부", async () => {
    expect(await check(store, "홍길동", "bible", DAY1)).toEqual({ ok: false, reason: "unknown_member" });
  });

  it("성경·다짐 각각 1점, 상태에 반영", async () => {
    expect(await check(store, USER, "bible", DAY1)).toEqual({ ok: true });
    let s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(1);
    expect(s.me.bible).toBe(true);
    expect(s.me.resolve).toBe(false);

    expect(await check(store, USER, "resolve", DAY1)).toEqual({ ok: true });
    s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(2);
    expect(s.me.resolve).toBe(true);
    expect(s.members.find((m) => m.name === USER)!.points).toBe(2);
    expect(s.todayCount).toBe(1);
  });

  it("같은 날 같은 항목은 두 번 못 한다", async () => {
    await check(store, USER, "bible", DAY1);
    expect(await check(store, USER, "bible", DAY1_LATE)).toEqual({ ok: false, reason: "already" });
    expect((await getState(store, USER, DAY1_LATE))!.total).toBe(1);
  });

  it("다음 날(KST 자정)이면 다시 할 수 있다", async () => {
    await check(store, USER, "bible", DAY1);
    expect(await check(store, USER, "bible", DAY2)).toEqual({ ok: true });
    const s = (await getState(store, USER, DAY2))!;
    expect(s.total).toBe(2);
    expect(s.today).toBe("2026-08-22");
    expect(s.me.bible).toBe(true); // 오늘(DAY2) 기준
  });

  it("서로 다른 사람의 체크는 독립이고 총점은 합산", async () => {
    await check(store, USER, "bible", DAY1);
    await check(store, OTHER, "bible", DAY1);
    await check(store, OTHER, "resolve", DAY1);
    const s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(3);
    expect(s.todayCount).toBe(2);
    expect(s.members.find((m) => m.name === OTHER)).toEqual({ name: OTHER, points: 2, bible: true, resolve: true });
  });

  it("이름 앞뒤 공백은 같은 사람으로 본다", async () => {
    await check(store, ` ${USER} `, "bible", DAY1);
    expect(await check(store, USER, "bible", DAY1)).toEqual({ ok: false, reason: "already" });
  });
});
