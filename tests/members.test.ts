import { describe, it, expect } from "vitest";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS, ensureMembers, findMember } from "@/lib/members";
import { login } from "@/lib/service";

describe("SEED_MEMBERS", () => {
  it("30명이고 관리자는 정확히 1명", () => {
    expect(SEED_MEMBERS).toHaveLength(30);
    expect(SEED_MEMBERS.filter((m) => m.isAdmin)).toHaveLength(1);
  });
  it("이름이 중복되지 않는다", () => {
    expect(new Set(SEED_MEMBERS.map((m) => m.name)).size).toBe(30);
  });
});

describe("ensureMembers", () => {
  it("비어 있으면 시드를 저장한다", async () => {
    const store = createMemoryStore();
    const members = await ensureMembers(store);
    expect(members).toEqual(SEED_MEMBERS);
    expect(await store.get("members")).toEqual(SEED_MEMBERS);
  });
  it("이미 있으면 저장된 것을 쓴다", async () => {
    const store = createMemoryStore();
    await store.set("members", [{ name: "테스트", isAdmin: true }]);
    expect(await ensureMembers(store)).toEqual([{ name: "테스트", isAdmin: true }]);
  });
});

describe("findMember", () => {
  const members = [
    { name: "김은혜", isAdmin: true },
    { name: "이주원", isAdmin: false },
  ];
  it("정확 일치", () => {
    expect(findMember(members, "이주원")).toEqual({ name: "이주원", isAdmin: false });
  });
  it("앞뒤 공백은 무시", () => {
    expect(findMember(members, "  김은혜 ")?.name).toBe("김은혜");
  });
  it("없는 이름·빈 문자열은 null", () => {
    expect(findMember(members, "홍길동")).toBeNull();
    expect(findMember(members, "")).toBeNull();
    expect(findMember(members, "   ")).toBeNull();
  });
});

describe("login", () => {
  it("명단에 있으면 ok와 관리자 여부", async () => {
    const store = createMemoryStore();
    const admin = SEED_MEMBERS.find((m) => m.isAdmin)!;
    const user = SEED_MEMBERS.find((m) => !m.isAdmin)!;
    expect(await login(store, admin.name)).toEqual({ ok: true, name: admin.name, isAdmin: true });
    expect(await login(store, user.name)).toEqual({ ok: true, name: user.name, isAdmin: false });
  });
  it("명단에 없으면 ok:false", async () => {
    expect(await login(createMemoryStore(), "홍길동")).toEqual({ ok: false });
  });
});
