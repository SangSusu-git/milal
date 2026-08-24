import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Store } from "@/lib/store/types";
import { createMemoryStore } from "@/lib/store/memory";
import { createFileStore } from "@/lib/store/file";
import { createRedisStore } from "@/lib/store/redis";

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

// 실제 Upstash 자격증명이 없는 환경이라 get/set은 로컬에서 검증할 수 없다 —
// 여기서는 환경 변수 해석과 생성 시 가드만 확인한다 (네트워크 호출 없음).
describe("redis store — env resolution guard", () => {
  const KEYS = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
  ] as const;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("환경 변수가 전혀 없으면 생성 시 즉시 에러를 던진다", () => {
    expect(() => createRedisStore()).toThrow(/Upstash Redis 환경 변수/);
  });

  it("UPSTASH_* 만 있어도 생성된다", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(() => createRedisStore()).not.toThrow();
  });

  it("KV_REST_API_* 폴백만 있어도 생성된다", () => {
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "token";
    expect(() => createRedisStore()).not.toThrow();
  });

  it("URL만 있고 토큰이 없으면 에러를 던진다", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    expect(() => createRedisStore()).toThrow(/Upstash Redis 환경 변수/);
  });
});
