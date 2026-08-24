import { describe, it, expect, beforeEach } from "vitest";
import type { Store } from "@/lib/store/types";
import type { Backup } from "@/lib/types";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS } from "@/lib/members";
import {
  getState,
  check,
  addRequest,
  listRequests,
  decide,
  recentLedger,
  setTotalDev,
  exportBackup,
  restoreBackup,
} from "@/lib/service";

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

  it("초기 상태는 0점 1단계, 명단 수 30명", async () => {
    const s = (await getState(store, USER, DAY1))!;
    expect(s.today).toBe("2026-08-21");
    expect(s.total).toBe(0);
    expect(s.stage).toBe(1);
    expect(s.me).toEqual({ name: USER, isAdmin: false, points: 0, bible: false, resolve: false, pendingCount: 0 });
    expect(s.memberCount).toBe(30);
    expect(s.todayCount).toBe(0);
  });

  it("관리자는 isAdmin true", async () => {
    expect((await getState(store, ADMIN, DAY1))!.me.isAdmin).toBe(true);
  });

  it("다른 사람의 기여 점수는 응답에 담기지 않는다", async () => {
    const s = (await getState(store, USER, DAY1))!;
    expect("members" in s).toBe(false);
  });

  it("me.points는 본인의 기여만 합산한다", async () => {
    await check(store, USER, "bible", DAY1); // USER +1
    await check(store, OTHER, "bible", DAY1); // OTHER +1
    await check(store, OTHER, "resolve", DAY1); // OTHER +1
    const userState = (await getState(store, USER, DAY1))!;
    const otherState = (await getState(store, OTHER, DAY1))!;
    expect(userState.me.points).toBe(1);
    expect(otherState.me.points).toBe(2);
    expect(userState.total).toBe(3);
  });

  it("todayCount는 오늘 성경·다짐 중 하나라도 한 서로 다른 사람 수", async () => {
    await check(store, USER, "bible", DAY1);
    await check(store, USER, "resolve", DAY1); // 같은 사람, 두 항목 — 1명으로 집계
    await check(store, OTHER, "bible", DAY1_LATE); // 같은 날, 다른 사람
    const s = (await getState(store, USER, DAY1_LATE))!;
    expect(s.todayCount).toBe(2);
  });

  it("todayCount는 어제 체크한 사람을 오늘로 세지 않는다", async () => {
    await check(store, USER, "bible", DAY1); // 어제
    await check(store, OTHER, "bible", DAY2); // 오늘
    const s = (await getState(store, USER, DAY2))!;
    expect(s.todayCount).toBe(1);
  });

  it("todayCount는 adjust 항목을 세지 않는다", async () => {
    await check(store, USER, "bible", DAY1);
    const before = (await getState(store, USER, DAY1))!.todayCount;
    expect(await setTotalDev(store, ADMIN, 500, DAY1)).toEqual({ ok: true, total: 500 });
    const after = (await getState(store, USER, DAY1))!.todayCount;
    expect(after).toBe(before);
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
    expect(s.me.points).toBe(2);
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
    const otherState = (await getState(store, OTHER, DAY1))!;
    expect(otherState.me).toMatchObject({ points: 2, bible: true, resolve: true });
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
    expect(await addRequest(store, USER, "bible" as never, "김영희", DAY1)).toEqual({ ok: false, reason: "bad_kind" });
    expect(await addRequest(store, "홍길동", "prayer", "김영희", DAY1)).toEqual({ ok: false, reason: "unknown_member" });
  });

  it("요청은 제한 없이 쌓이고 대기 수가 늘어난다", async () => {
    expect(await addRequest(store, USER, "prayer", "김영희", DAY1)).toEqual({ ok: true, pendingCount: 1 });
    expect(await addRequest(store, USER, "prayer", "김영희", DAY1)).toEqual({ ok: true, pendingCount: 2 });
    expect(await addRequest(store, USER, "invite_face", "김영희", DAY1)).toEqual({ ok: true, pendingCount: 3 });
    expect((await getState(store, USER, DAY1))!.me.pendingCount).toBe(3);
    expect((await getState(store, USER, DAY1))!.total).toBe(0); // 아직 미반영
  });

  it("대상 이름은 앞뒤 공백이 다듬어져 저장되고 목록에도 그대로 담긴다", async () => {
    await addRequest(store, USER, "prayer", "  외부인 김영희  ", DAY1);
    const list = (await listRequests(store, ADMIN))!;
    expect(list).toHaveLength(1);
    expect(list[0].target).toBe("외부인 김영희");
  });

  it("대상 이름은 명단과 무관하게 자유 텍스트로 저장된다", async () => {
    // 명단에 없는 이름이어도 거부하지 않는다 — 밖의 사람을 위해 기도·권유할 수 있다.
    expect(await addRequest(store, USER, "prayer", "명단밖사람", DAY1)).toEqual({ ok: true, pendingCount: 1 });
  });

  it("빈 대상 또는 공백만 있는 대상은 거부되고 대기 목록에 쌓이지 않는다", async () => {
    expect(await addRequest(store, USER, "prayer", "", DAY1)).toEqual({ ok: false, reason: "empty_target" });
    expect(await addRequest(store, USER, "prayer", "   ", DAY1)).toEqual({ ok: false, reason: "empty_target" });
    expect((await listRequests(store, ADMIN))!).toEqual([]);
  });

  it("40자를 넘는 대상은 거부되고 대기 목록에 쌓이지 않는다", async () => {
    const tooLong = "가".repeat(41);
    expect(await addRequest(store, USER, "prayer", tooLong, DAY1)).toEqual({ ok: false, reason: "target_too_long" });
    expect((await listRequests(store, ADMIN))!).toEqual([]);

    const exactly40 = "가".repeat(40);
    expect(await addRequest(store, USER, "prayer", exactly40, DAY1)).toEqual({ ok: true, pendingCount: 1 });
  });

  it("비관리자는 목록을 볼 수 없다", async () => {
    await addRequest(store, USER, "prayer", "김영희", DAY1);
    expect(await listRequests(store, USER)).toBeNull();
    expect(await listRequests(store, "홍길동")).toBeNull();
  });

  it("관리자는 요청자 이름·종류·대상·시각을 본다", async () => {
    await addRequest(store, USER, "prayer", "김영희", DAY1);
    await addRequest(store, OTHER, "invite_remote", "박철수", DAY1_LATE);
    const list = (await listRequests(store, ADMIN))!;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: USER, kind: "prayer", target: "김영희", requestedAt: DAY1.toISOString() });
    expect(list[1]).toMatchObject({ name: OTHER, kind: "invite_remote", target: "박철수" });
    expect(typeof list[0].id).toBe("string");
    expect(list[0].id).not.toBe(list[1].id);
  });

  it("승인하면 종류별 점수가 요청자 이름으로 반영되고 목록에서 사라진다", async () => {
    await addRequest(store, USER, "prayer", "김영희", DAY1);
    await addRequest(store, USER, "invite_remote", "박철수", DAY1);
    await addRequest(store, OTHER, "invite_face", "이순신", DAY1);
    const [r1, r2, r3] = (await listRequests(store, ADMIN))!;

    expect(await decide(store, ADMIN, r1.id, true, DAY1)).toEqual({ ok: true, total: 3 });
    expect(await decide(store, ADMIN, r2.id, true, DAY1)).toEqual({ ok: true, total: 8 });
    expect(await decide(store, ADMIN, r3.id, true, DAY1)).toEqual({ ok: true, total: 15 });

    expect(await listRequests(store, ADMIN)).toEqual([]);
    const s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(15);
    expect(s.me.pendingCount).toBe(0);
    expect(s.me.points).toBe(8);
    expect((await getState(store, OTHER, DAY1))!.me.points).toBe(7);
  });

  it("승인 시 원장에는 요청자만 기록되고 대상은 남지 않는다", async () => {
    await addRequest(store, USER, "prayer", "김영희", DAY1);
    const [r] = (await listRequests(store, ADMIN))!;
    await decide(store, ADMIN, r.id, true, DAY1);
    const recent = await recentLedger(store, 1);
    expect(recent[0]).toMatchObject({ name: USER, kind: "prayer", points: 3 });
    expect("target" in recent[0]).toBe(false);
  });

  it("거절하면 0점이고 목록에서만 사라진다", async () => {
    await addRequest(store, USER, "invite_face", "김영희", DAY1);
    const [r] = (await listRequests(store, ADMIN))!;
    expect(await decide(store, ADMIN, r.id, false, DAY1)).toEqual({ ok: true, total: 0 });
    expect(await listRequests(store, ADMIN)).toEqual([]);
    expect((await getState(store, USER, DAY1))!.total).toBe(0);
  });

  it("비관리자는 승인할 수 없다", async () => {
    await addRequest(store, USER, "prayer", "김영희", DAY1);
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

  it("recentLedger(store, 0)은 원장이 비어있지 않아도 빈 배열", async () => {
    await check(store, USER, "bible", DAY1);
    expect(await recentLedger(store, 0)).toEqual([]);
  });
});

describe("exportBackup & restoreBackup", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("비관리자는 백업할 수 없다", async () => {
    expect(await exportBackup(store, USER)).toBeNull();
    expect(await exportBackup(store, "홍길동")).toBeNull();
  });

  it("비관리자는 복원할 수 없다", async () => {
    const backup = (await exportBackup(store, ADMIN))!;
    expect(await restoreBackup(store, USER, backup)).toEqual({ ok: false, reason: "forbidden" });
    expect(await restoreBackup(store, "홍길동", backup)).toEqual({ ok: false, reason: "forbidden" });
  });

  it("내보내기 → 복원 왕복은 총점·개인별 점수·오늘 체크·대기 요청을 보존한다", async () => {
    await check(store, USER, "bible", DAY1);
    await check(store, USER, "resolve", DAY1);
    await check(store, OTHER, "bible", DAY1);
    await addRequest(store, USER, "prayer", "김영희", DAY1);

    const backup = (await exportBackup(store, ADMIN))!;
    expect(backup.version).toBe(1);
    expect(backup.members).toEqual(SEED_MEMBERS);

    // 백업 이후 상태를 더 바꾼다 — 복원하면 백업 시점으로 되돌아가야 한다.
    await check(store, OTHER, "resolve", DAY1);
    await addRequest(store, OTHER, "invite_face", "이순신", DAY1);

    expect(await restoreBackup(store, ADMIN, backup)).toEqual({ ok: true });

    const s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(3);
    expect(s.me.points).toBe(2);
    expect(s.me.bible).toBe(true);
    expect(s.me.resolve).toBe(true);
    expect(s.me.pendingCount).toBe(1);

    const otherS = (await getState(store, OTHER, DAY1))!;
    expect(otherS.me.points).toBe(1);
    expect(otherS.me.bible).toBe(true);
    expect(otherS.me.resolve).toBe(false); // 백업 이후에 추가된 체크는 사라졌다
    expect(otherS.me.pendingCount).toBe(0); // 백업 이후에 추가된 요청도 사라졌다
  });

  it("복원 검증: 관리자가 0명이면 invalid이고 기존 데이터는 그대로다", async () => {
    await check(store, USER, "bible", DAY1);
    const before = (await getState(store, USER, DAY1))!;
    const bad = {
      version: 1,
      exportedAt: new Date().toISOString(),
      members: [{ name: "가", isAdmin: false }],
      requests: [],
      ledger: [],
      checks: {},
    };
    expect(await restoreBackup(store, ADMIN, bad)).toEqual({ ok: false, reason: "invalid" });
    expect(await getState(store, USER, DAY1)).toEqual(before);
  });

  it("복원 검증: 관리자가 2명이면 invalid이고 기존 데이터는 그대로다", async () => {
    await check(store, USER, "bible", DAY1);
    const before = (await getState(store, USER, DAY1))!;
    const bad = {
      version: 1,
      exportedAt: new Date().toISOString(),
      members: [
        { name: "가", isAdmin: true },
        { name: "나", isAdmin: true },
      ],
      requests: [],
      ledger: [],
      checks: {},
    };
    expect(await restoreBackup(store, ADMIN, bad)).toEqual({ ok: false, reason: "invalid" });
    expect(await getState(store, USER, DAY1)).toEqual(before);
  });

  it("복원 검증: 이름이 중복되면 invalid이고 기존 데이터는 그대로다", async () => {
    await check(store, USER, "bible", DAY1);
    const before = (await getState(store, USER, DAY1))!;
    const bad = {
      version: 1,
      exportedAt: new Date().toISOString(),
      members: [
        { name: "가", isAdmin: true },
        { name: "가", isAdmin: false },
      ],
      requests: [],
      ledger: [],
      checks: {},
    };
    expect(await restoreBackup(store, ADMIN, bad)).toEqual({ ok: false, reason: "invalid" });
    expect(await getState(store, USER, DAY1)).toEqual(before);
  });

  it("복원 검증: 명단이 비어있으면 invalid이고 기존 데이터는 그대로다", async () => {
    await check(store, USER, "bible", DAY1);
    const before = (await getState(store, USER, DAY1))!;
    const bad = { version: 1, exportedAt: new Date().toISOString(), members: [], requests: [], ledger: [], checks: {} };
    expect(await restoreBackup(store, ADMIN, bad)).toEqual({ ok: false, reason: "invalid" });
    expect(await getState(store, USER, DAY1)).toEqual(before);
  });

  it("복원 검증: version이 1이 아니면 invalid이고 기존 데이터는 그대로다", async () => {
    await check(store, USER, "bible", DAY1);
    const before = (await getState(store, USER, DAY1))!;
    const bad = {
      version: 2,
      exportedAt: new Date().toISOString(),
      members: SEED_MEMBERS,
      requests: [],
      ledger: [],
      checks: {},
    };
    expect(await restoreBackup(store, ADMIN, bad)).toEqual({ ok: false, reason: "invalid" });
    expect(await getState(store, USER, DAY1)).toEqual(before);
  });

  it("새 명단으로 복원하면 예전 checks는 버려지고 총점은 복원된 ledger를 따른다", async () => {
    await check(store, USER, "bible", DAY1);
    await check(store, OTHER, "bible", DAY1); // 복원 전 총점 2

    const newAdmin = "새관리자";
    const newUser = "새사용자";
    const backup: Backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      members: [
        { name: newAdmin, isAdmin: true },
        { name: newUser, isAdmin: false },
      ],
      requests: [],
      ledger: [
        { at: DAY1.toISOString(), name: newUser, kind: "bible", points: 1 },
        { at: DAY1.toISOString(), name: newUser, kind: "resolve", points: 1 },
        { at: DAY1.toISOString(), name: newAdmin, kind: "prayer", points: 3 },
      ],
      checks: {}, // 예전 USER/OTHER의 checks는 여기 없다 — 새 명단 밖이라 복원되지 않는다
    };
    expect(await restoreBackup(store, ADMIN, backup)).toEqual({ ok: true });

    // 예전 이름들은 더 이상 명단에 없다
    expect(await getState(store, ADMIN, DAY1)).toBeNull();
    expect(await getState(store, USER, DAY1)).toBeNull();
    expect(await getState(store, OTHER, DAY1)).toBeNull();

    const s = (await getState(store, newUser, DAY1))!;
    expect(s.total).toBe(5); // 예전 checks(2)가 아니라 복원된 ledger(5)를 따른다
    expect(s.me.points).toBe(2);
    expect(s.me.bible).toBe(false); // 새 명단의 새 이름이므로 예전 체크가 이어지지 않는다
    expect(s.memberCount).toBe(2);

    // 새 명단의 checks만 남는다 — 예전 이름의 checks는 버려졌다(재조회 불가)
    const reExported = (await exportBackup(store, newAdmin))!;
    expect(Object.keys(reExported.checks).sort()).toEqual([newAdmin, newUser].sort());
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
    expect(s.me.points).toBe(1);
    // 내려가는 조정도 가능
    expect(await setTotalDev(store, ADMIN, 0, DAY1)).toEqual({ ok: true, total: 0 });
    s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(0);
    expect(s.stage).toBe(1);
  });
});
