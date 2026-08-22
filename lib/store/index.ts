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
  if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL) {
    // Vercel 배포 환경은 /tmp 밖의 파일시스템이 읽기 전용이라, 토큰이 없을 때
    // 파일 저장소로 조용히 폴백하면 모든 요청이 알 수 없는 500으로 실패한다.
    // NODE_ENV가 아니라 process.env.VERCEL로 판별하는 이유: 이 프로젝트의 검증은
    // 로컬에서 `npm run build && npm run start`로도 하는데, 그때도 NODE_ENV는
    // production이지만 파일 저장소가 정상 동작해야 하기 때문이다.
    throw new Error("BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다. Vercel 프로젝트에 Blob 스토어를 연결하세요.");
  }
  const store = process.env.BLOB_READ_WRITE_TOKEN
    ? createBlobStore()
    : createFileStore(join(process.cwd(), "data"));
  globalThis.__milalStore = store;
  return store;
}

export type { Store } from "./types";
