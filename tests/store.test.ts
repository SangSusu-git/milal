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
    const value = { a: 1 };
    await store.set("checks/홍길동", value);
    const text = readFileSync(join(dir, "checks__홍길동.json"), "utf8");
    expect(JSON.parse(text)).toEqual(value);
    expect(text).toBe(JSON.stringify(value, null, 2) + "\n"); // pretty-printed with 2-space indent
  });

  it("같은 디렉터리의 새 인스턴스가 기존 파일을 읽는다", async () => {
    await createFileStore(dir).set("k", "v");
    expect(await createFileStore(dir).get("k")).toBe("v");
  });

  it("동시 쓰기 충돌시 두 쓰기 모두 성공하고 하나의 값이 저장된다", async () => {
    const store = createFileStore(dir);
    const value1 = { n: 1 };
    const value2 = { n: 2 };
    // 같은 키에 두 concurrent set() 호출 — 하나는 실패할 수도 있으므로 Promise.allSettled 사용
    const results = await Promise.allSettled([
      store.set("k", value1),
      store.set("k", value2),
    ]);
    // 둘 다 성공해야 함 (collision-resistant temp filename 덕분)
    expect(results).toEqual([{ status: "fulfilled" }, { status: "fulfilled" }]);
    // 저장된 값은 둘 중 하나여야 함
    const stored = await store.get<{ n: number }>("k");
    expect([value1, value2]).toContainEqual(stored);
  });

  it("돌아가는 중에 디렉터리가 사라져도 다시 만들고 저장한다", async () => {
    const store = createFileStore(dir);
    await store.set("k", { a: 1 });
    rmSync(dir, { recursive: true, force: true }); // README가 안내하는 초기화 방법
    await expect(store.set("k", { a: 2 })).resolves.toBeUndefined();
    expect(await store.get("k")).toEqual({ a: 2 });
  });
});
