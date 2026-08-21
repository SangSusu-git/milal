import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { Store } from "./types";

/** 키의 "/"를 "__"로 바꿔 한 디렉터리에 평평하게 저장한다. */
function fileNameFor(key: string): string {
  return key.replaceAll("/", "__") + ".json";
}

export function createFileStore(dir: string): Store {
  const ready = mkdir(dir, { recursive: true });

  return {
    async get<T>(key: string): Promise<T | null> {
      await ready;
      try {
        const text = await readFile(join(dir, fileNameFor(key)), "utf8");
        return JSON.parse(text) as T;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      await ready;
      const target = join(dir, fileNameFor(key));
      const tmp = target + "." + process.pid + "." + Date.now() + ".tmp";
      await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
      await rename(tmp, target); // 원자적 교체 — 쓰다 만 파일이 남지 않게
    },
  };
}
