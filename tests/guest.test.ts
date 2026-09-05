import { describe, it, expect, beforeEach } from "vitest";
import type { Store } from "@/lib/store/types";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS } from "@/lib/members";
import { addRequest, check, exportBackup, getState, login, restoreBackup } from "@/lib/service";

const ADMIN = SEED_MEMBERS.find((m) => m.isAdmin)!.name;
const GUEST = "게스트";

// KST 2026-08-21 10:00
const DAY1 = new Date("2026-08-21T01:00:00Z");

/** 명단에 게스트를 넣은 저장소 */
async function storeWithGuest(): Promise<Store> {
  const store = createMemoryStore();
  const backup = (await exportBackup(store, ADMIN))!;
  backup.members = [...backup.members, { name: GUEST, isAdmin: false, isGuest: true }];
  const r = await restoreBackup(store, ADMIN, backup);
  expect(r).toEqual({ ok: true });
  return store;
}

describe("게스트 (보기 전용)", () => {
  let store: Store;
  beforeEach(async () => {
    store = await storeWithGuest();
  });

  it("로그인은 되고 상태에 isGuest가 켜진다", async () => {
    expect(await login(store, GUEST)).toEqual({ ok: true, name: GUEST, isAdmin: false });
    const s = (await getState(store, GUEST, DAY1))!;
    expect(s.me.isGuest).toBe(true);
    expect(s.me.isAdmin).toBe(false);
  });

  it("체크는 guest 사유로 거부되고 점수가 안 쌓인다", async () => {
    expect(await check(store, GUEST, "bible", DAY1)).toEqual({ ok: false, reason: "guest" });
    expect((await getState(store, GUEST, DAY1))!.total).toBe(0);
  });

  it("요청도 guest 사유로 거부된다", async () => {
    expect(await addRequest(store, GUEST, "prayer", "친구", DAY1)).toEqual({
      ok: false,
      reason: "guest",
    });
  });

  it("일반 구성원은 isGuest가 꺼져 있고 체크가 된다", async () => {
    const USER = SEED_MEMBERS.find((m) => !m.isAdmin)!.name;
    expect((await getState(store, USER, DAY1))!.me.isGuest).toBe(false);
    expect(await check(store, USER, "bible", DAY1)).toEqual({ ok: true });
  });

  it("백업 검증: isGuest는 불리언만 허용", async () => {
    const backup = (await exportBackup(store, ADMIN))!;
    const broken = {
      ...backup,
      members: [...backup.members.filter((m) => m.name !== GUEST), { name: GUEST, isAdmin: false, isGuest: "yes" }],
    };
    expect(await restoreBackup(store, ADMIN, broken)).toEqual({ ok: false, reason: "invalid" });
  });
});
