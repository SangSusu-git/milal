import type { Store } from "./types";

export function createMemoryStore(): Store {
  const map = new Map<string, string>();
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = map.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    },
    async set<T>(key: string, value: T): Promise<void> {
      map.set(key, JSON.stringify(value));
    },
  };
}
