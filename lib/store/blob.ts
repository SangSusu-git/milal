import { put, head, BlobNotFoundError } from "@vercel/blob";
import type { Store } from "./types";

/**
 * Vercel Blob 저장소. 키 하나 = JSON 파일 하나.
 * 배포 단계에서 실제 Blob 스토어를 붙여 검증한다 (로컬 테스트 범위 밖).
 */
export function createBlobStore(prefix = "milal"): Store {
  const pathFor = (key: string) => `${prefix}/${key}.json`;

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const meta = await head(pathFor(key));
        const res = await fetch(meta.url, { cache: "no-store" });
        if (!res.ok) return null;
        return (await res.json()) as T;
      } catch (err) {
        if (err instanceof BlobNotFoundError) return null;
        throw err;
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      await put(pathFor(key), JSON.stringify(value, null, 2), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    },
  };
}
