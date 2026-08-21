import { describe, it, expect, beforeEach } from "vitest";
import type { Store } from "@/lib/store/types";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS } from "@/lib/members";
import { getState, check, addRequest, listRequests, decide, recentLedger, setTotalDev } from "@/lib/service";

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

describe("requests & decide", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("잘못된 종류·명단 외 이름은 거부", async () => {
    expect(await addRequest(store, USER, "bible" as never, DAY1)).toEqual({ ok: false, reason: "bad_kind" });
    expect(await addRequest(store, "홍길동", "prayer", DAY1)).toEqual({ ok: false, reason: "unknown_member" });
  });

  it("요청은 제한 없이 쌓이고 대기 수가 늘어난다", async () => {
    expect(await addRequest(store, USER, "prayer", DAY1)).toEqual({ ok: true, pendingCount: 1 });
    expect(await addRequest(store, USER, "prayer", DAY1)).toEqual({ ok: true, pendingCount: 2 });
    expect(await addRequest(store, USER, "invite_face", DAY1)).toEqual({ ok: true, pendingCount: 3 });
    expect((await getState(store, USER, DAY1))!.me.pendingCount).toBe(3);
    expect((await getState(store, USER, DAY1))!.total).toBe(0); // 아직 미반영
  });

  it("비관리자는 목록을 볼 수 없다", async () => {
    await addRequest(store, USER, "prayer", DAY1);
    expect(await listRequests(store, USER)).toBeNull();
    expect(await listRequests(store, "홍길동")).toBeNull();
  });

  it("관리자는 요청자 이름·종류·시각을 본다", async () => {
    await addRequest(store, USER, "prayer", DAY1);
    await addRequest(store, OTHER, "invite_remote", DAY1_LATE);
    const list = (await listRequests(store, ADMIN))!;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: USER, kind: "prayer", requestedAt: DAY1.toISOString() });
    expect(list[1]).toMatchObject({ name: OTHER, kind: "invite_remote" });
    expect(typeof list[0].id).toBe("string");
    expect(list[0].id).not.toBe(list[1].id);
  });

  it("승인하면 종류별 점수가 요청자 이름으로 반영되고 목록에서 사라진다", async () => {
    await addRequest(store, USER, "prayer", DAY1);
    await addRequest(store, USER, "invite_remote", DAY1);
    await addRequest(store, OTHER, "invite_face", DAY1);
    const [r1, r2, r3] = (await listRequests(store, ADMIN))!;

    expect(await decide(store, ADMIN, r1.id, true, DAY1)).toEqual({ ok: true, total: 3 });
    expect(await decide(store, ADMIN, r2.id, true, DAY1)).toEqual({ ok: true, total: 8 });
    expect(await decide(store, ADMIN, r3.id, true, DAY1)).toEqual({ ok: true, total: 15 });

    expect(await listRequests(store, ADMIN)).toEqual([]);
    const s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(15);
    expect(s.me.pendingCount).toBe(0);
    expect(s.members.find((m) => m.name === USER)!.points).toBe(8);
    expect(s.members.find((m) => m.name === OTHER)!.points).toBe(7);
  });

  it("거절하면 0점이고 목록에서만 사라진다", async () => {
    await addRequest(store, USER, "invite_face", DAY1);
    const [r] = (await listRequests(store, ADMIN))!;
    expect(await decide(store, ADMIN, r.id, false, DAY1)).toEqual({ ok: true, total: 0 });
    expect(await listRequests(store, ADMIN)).toEqual([]);
    expect((await getState(store, USER, DAY1))!.total).toBe(0);
  });

  it("비관리자는 승인할 수 없다", async () => {
    await addRequest(store, USER, "prayer", DAY1);
    const [r] = (await listRequests(store, ADMIN))!;
    expect(await decide(store, USER, r.id, true, DAY1)).toEqual({ ok: false, reason: "forbidden" });
    expect(await listRequests(store, ADMIN)).toHaveLength(1);
  });

  it("없는 id는 not_found", async () => {
    expect(await decide(store, ADMIN, "nope", true, DAY1)).toEqual({ ok: false, reason: "not_found" });
  });

  it("recentLedger는 최신순으로 limit만큼", async () => {
    await check(store, USER, "bible", DAY1);
    await check(store, OTHER, "bible", DAY1_LATE);
    const recent = await recentLedger(store, 1);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ name: OTHER, kind: "bible" });
  });
});

describe("setTotalDev", () => {
  it("관리자만, 총점을 목표값으로 맞추는 adjust 항목을 추가한다", async () => {
    const store = createMemoryStore();
    await check(store, USER, "bible", DAY1); // total 1
    expect(await setTotalDev(store, USER, 400, DAY1)).toEqual({ ok: false, reason: "forbidden" });
    expect(await setTotalDev(store, ADMIN, 400, DAY1)).toEqual({ ok: true, total: 400 });
    let s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(400);
    expect(s.stage).toBe(3);
    // 개인 기여 점수는 건드리지 않는다
    expect(s.members.find((m) => m.name === USER)!.points).toBe(1);
    // 내려가는 조정도 가능
    expect(await setTotalDev(store, ADMIN, 0, DAY1)).toEqual({ ok: true, total: 0 });
    s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(0);
    expect(s.stage).toBe(1);
  });
});
