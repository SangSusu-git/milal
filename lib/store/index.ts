import { join } from "node:path";
import type { Store } from "./types";
import { createFileStore } from "./file";
import { createBlobStore } from "./blob";

declare global {
  // 개발 서버의 HMR에서도 인스턴스를 하나만 유지하기 위해 globalThis에 둔다.
  var __milalStore: Store | undefined;
}

export function getStore(): Store {
  if (globalThis.__milalStore) return globalThis.__milalStore;
  const store = process.env.BLOB_READ_WRITE_TOKEN
    ? createBlobStore()
    : createFileStore(join(process.cwd(), "data"));
  globalThis.__milalStore = store;
  return store;
}

export type { Store } from "./types";
