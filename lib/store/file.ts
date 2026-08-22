import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
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
      const write = async () => {
        const tmp = target + "." + randomUUID() + ".tmp";
        await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
        await rename(tmp, target); // 원자적 교체 — 쓰다 만 파일이 남지 않게
      };
      try {
        await write();
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        // 서버가 도는 동안 data/ 폴더가 통째로 사라졌을 수 있다. README가 안내하는
        // 초기화 방법이 바로 그것이므로, 한 번 다시 만들고 재시도한다.
        await mkdir(dir, { recursive: true });
        await write();
      }
    },
  };
}
