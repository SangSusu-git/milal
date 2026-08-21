import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Store } from "@/lib/store/types";
import { createMemoryStore } from "@/lib/store/memory";
import { createFileStore } from "@/lib/store/file";

function storeContract(name: string, make: () => Store) {
  describe(name, () => {
    let store: Store;
    beforeEach(() => {
      store = make();
    });

    it("없는 키는 null", async () => {
      expect(await store.get("nope")).toBeNull();
    });

    it("저장 후 읽기", async () => {
      await store.set("a", { x: 1, list: [1, 2] });
      expect(await store.get("a")).toEqual({ x: 1, list: [1, 2] });
    });

    it("덮어쓰기", async () => {
      await store.set("a", 1);
      await store.set("a", 2);
      expect(await store.get("a")).toBe(2);
    });

    it("반환값을 수정해도 저장된 값은 바뀌지 않는다", async () => {
      await store.set("a", { list: [1] });
      const v = (await store.get<{ list: number[] }>("a"))!;
      v.list.push(2);
      expect(await store.get("a")).toEqual({ list: [1] });
    });

    it("슬래시가 포함된 키", async () => {
      await store.set("checks/홍길동", { "2026-08-21": { bible: true, resolve: false } });
      expect(await store.get("checks/홍길동")).toEqual({
        "2026-08-21": { bible: true, resolve: false },
      });
    });
  });
}

storeContract("memory store", () => createMemoryStore());

describe("file store", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "milal-store-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  storeContract("contract", () => createFileStore(dir));

  it("디렉터리가 없어도 만든다", async () => {
    const nested = join(dir, "a", "b");
    const store = createFileStore(nested);
    await store.set("k", 1);
    expect(existsSync(nested)).toBe(true);
  });

  it("사람이 읽을 수 있는 JSON 파일로 저장한다", async () => {
    const store = createFileStore(dir);
    await store.set("checks/홍길동", { a: 1 });
    const text = readFileSync(join(dir, "checks__홍길동.json"), "utf8");
    expect(JSON.parse(text)).toEqual({ a: 1 });
    expect(text).toContain("\n"); // pretty-printed
  });

  it("같은 디렉터리의 새 인스턴스가 기존 파일을 읽는다", async () => {
    await createFileStore(dir).set("k", "v");
    expect(await createFileStore(dir).get("k")).toBe("v");
  });
});
