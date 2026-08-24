import { Redis } from "@upstash/redis";
import type { Store } from "./types";

/**
 * Upstash Redis(REST) 저장소. 배포 환경 전용.
 *
 * Vercel Marketplace의 Upstash 통합은 과거 두 가지 이름 규칙으로 환경 변수를 주입했다 —
 * Upstash 고유 이름(UPSTASH_REDIS_REST_URL/TOKEN)과 Vercel KV 시절 이름(KV_REST_API_URL/TOKEN).
 * 어느 쪽이 주입되든 동작하도록 둘 다 받아들이되, Upstash 고유 이름을 우선한다.
 *
 * automaticDeserialization: false로 생성해 memory.ts와 동일하게 JSON.stringify/parse를
 * 직접 수행한다 — SDK의 자동 역직렬화에 의존하면 문자열/객체가 섞여 반환될 수 있어
 * get()의 반환 타입을 예측하기 어렵다.
 */
export function createRedisStore(): Store {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Upstash Redis 환경 변수가 없습니다 (UPSTASH_REDIS_REST_URL/TOKEN 또는 KV_REST_API_URL/TOKEN)."
    );
  }

  const redis = new Redis({ url, token, automaticDeserialization: false });

  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await redis.get<string>(key);
      return raw === null || raw === undefined ? null : (JSON.parse(raw) as T);
    },
    async set<T>(key: string, value: T): Promise<void> {
      await redis.set(key, JSON.stringify(value));
    },
  };
}
