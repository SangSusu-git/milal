# 밀알 (Milal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 30명이 이름으로 입장해 매일 성경읽기·다짐을 체크하고 기도부탁·권유 요청을 올리면, 관리자 승인을 거쳐 하나의 공동체 밀알이 5단계로 자라는 모바일 웹앱을 로컬에서 동작하는 상태로 만든다.

**Architecture:** Next.js App Router 풀스택 하나. 규칙 로직(`lib/rules.ts`)은 순수 함수, 상태 조작(`lib/service.ts`)은 `Store` 인터페이스(`get`/`set`)만 의존하고, API 라우트는 얇게 유지한다. 저장소는 로컬 파일(`data/`) / 메모리(테스트) / Vercel Blob(배포) 세 구현을 환경변수로 바꿔 끼운다. 화면은 클라이언트 컴포넌트가 `/api/*`를 호출해 그린다.

**Tech Stack:** Node 26, Next.js 16.3 (App Router, TypeScript, Tailwind v4), Vitest 4, `@vercel/blob`, Pretendard 폰트(CDN)

**Spec:** `docs/superpowers/specs/2026-08-21-milal-design.md`

## Global Constraints

- 날짜 판정은 항상 `Asia/Seoul` 기준 `YYYY-MM-DD`. 서버 위치와 무관.
- 포인트: 성경 +1, 다짐 +1, 기도부탁 +3, 비대면 권유 +5, 대면 권유 +7. 점수는 서버가 종류로 결정하며 클라이언트가 보내지 않는다.
- 단계 구간: 0–199 (1) / 200–399 (2) / 400–699 (3) / 700–999 (4) / 1000+ (5). 최대 점수 표기 1000.
- 총점은 저장하지 않고 `ledger` 합산으로 계산한다.
- 저장소 키: `members`, `checks/{name}`, `requests`, `ledger`.
- 관리자 판정: `members`에서 `isAdmin: true`인 이름만.
- 개발 전용 기능(점수 조정, 장면 미리보기)은 `process.env.NODE_ENV === "production"`이면 404.
- 테스트 데이터 폴더 `data/`는 git에 올리지 않는다.
- 모든 커밋 메시지 끝에 아래 두 줄을 붙인다:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB
  ```

---

## 파일 구조

```
milal/
  app/
    layout.tsx                 폰트·메타·전역 스타일
    globals.css                Tailwind + 커스텀 애니메이션
    page.tsx                   입장 화면
    field/page.tsx             밭 화면
    admin/page.tsx             관리자 화면
    dev/scene/page.tsx         5단계 장면 미리보기 (개발 전용)
    api/login/route.ts
    api/state/route.ts
    api/check/route.ts
    api/request/route.ts
    api/admin/requests/route.ts
    api/admin/decide/route.ts
    api/dev/set-total/route.ts (개발 전용)
  components/
    WheatScene.tsx             단계별 SVG 장면
    ProgressCard.tsx           단계 이름·진행바
    CheckButtons.tsx           오늘 체크 버튼 2개
    RequestButtons.tsx         요청 버튼 3개
    MemberList.tsx             함께 자라는 사람들
  lib/
    types.ts                   공용 타입
    rules.ts                   KST 날짜, 점수표, 단계 계산 (순수 함수)
    members.ts                 30명 시드 명단, 조회
    service.ts                 로그인·상태·체크·요청·승인 (Store 의존)
    api.ts                     라우트용 응답 헬퍼
    client.ts                  브라우저용 fetch·localStorage 헬퍼
    store/types.ts             Store 인터페이스
    store/memory.ts
    store/file.ts
    store/blob.ts
    store/index.ts             환경에 따른 Store 선택
  tests/
    rules.test.ts
    store.test.ts
    members.test.ts
    service.test.ts
  vitest.config.ts
  data/                        로컬 저장소 (gitignore)
```

---

### Task 1: 프로젝트 스캐폴딩과 테스트 러너

**Files:**
- Create: Next.js 기본 파일 일체 (`package.json`, `tsconfig.json`, `next.config.ts`, `app/*`, `eslint.config.mjs`, `postcss.config.mjs`)
- Create: `vitest.config.ts`, `tests/smoke.test.ts`
- Modify: `.gitignore` (data/ 추가), `package.json` (test 스크립트)

**Interfaces:**
- Produces: `npm run dev`, `npm test`, 경로 별칭 `@/*` → 프로젝트 루트

- [ ] **Step 1: 임시 폴더에 Next.js 생성 후 레포로 복사**

레포에 `docs/`와 `.git`이 이미 있어 `create-next-app`이 현재 폴더를 거부하므로 임시 폴더에 만들고 옮긴다.

```bash
cd /Users/fastview/Desktop/claude_test
rm -rf milal-scaffold
npx --yes create-next-app@latest milal-scaffold --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
# 숨김 파일 포함해 복사 (.git 제외 — scaffold에는 .git이 없지만 안전하게)
rsync -a --exclude .git milal-scaffold/ milal/
rm -rf milal-scaffold
cd milal && ls -a
```

Expected: `app/ public/ package.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs .gitignore node_modules/` 등이 보인다. `docs/`는 그대로 있다.

- [ ] **Step 2: Vitest 설치**

```bash
npm install -D vitest
npm install @vercel/blob
```

- [ ] **Step 3: Vitest 설정과 스모크 테스트 작성**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
```

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

`package.json`의 `"scripts"`에 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: `.gitignore`에 로컬 저장소 폴더 추가**

`.gitignore` 맨 아래에 추가:
```
# milal 로컬 저장소
/data
```

- [ ] **Step 5: 테스트와 개발 서버 확인**

```bash
npm test
```
Expected: `1 passed`.

```bash
npm run dev &
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```
Expected: `200`.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "chore: Next.js 16 스캐폴딩과 Vitest 설정

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 2: 공용 타입과 규칙 (KST 날짜, 점수표, 단계)

**Files:**
- Create: `lib/types.ts`, `lib/rules.ts`
- Test: `tests/rules.test.ts`

**Interfaces:**
- Produces:
  - `lib/types.ts`: `CheckKind`, `RequestKind`, `LedgerKind`, `Stage`, `Member`, `DayCheck`, `Checks`, `PendingRequest`, `LedgerEntry`, `MemberSummary`, `FieldState`
  - `lib/rules.ts`: `MAX_POINTS`, `CHECK_POINTS`, `REQUEST_POINTS`, `STAGE_THRESHOLDS`, `STAGE_INFO`, `KIND_LABEL`, `todayKST(now?)`, `stageOf(total)`, `nextThreshold(total)`, `sumPoints(ledger)`, `isCheckKind(x)`, `isRequestKind(x)`

- [ ] **Step 1: 타입 파일 작성**

`lib/types.ts`:
```ts
export type CheckKind = "bible" | "resolve";
export type RequestKind = "prayer" | "invite_remote" | "invite_face";
/** adjust는 개발용 점수 조정에만 쓰인다. */
export type LedgerKind = CheckKind | RequestKind | "adjust";
export type Stage = 1 | 2 | 3 | 4 | 5;

export interface Member {
  name: string;
  isAdmin: boolean;
}

export interface DayCheck {
  bible: boolean;
  resolve: boolean;
}

/** 날짜(YYYY-MM-DD, KST) → 그날의 체크 */
export type Checks = Record<string, DayCheck>;

export interface PendingRequest {
  id: string;
  name: string;
  kind: RequestKind;
  requestedAt: string; // ISO 8601
}

export interface LedgerEntry {
  at: string; // ISO 8601
  name: string;
  kind: LedgerKind;
  points: number;
}

export interface MemberSummary {
  name: string;
  points: number;
  bible: boolean;
  resolve: boolean;
}

export interface FieldState {
  today: string;
  total: number;
  stage: Stage;
  me: {
    name: string;
    isAdmin: boolean;
    bible: boolean;
    resolve: boolean;
    pendingCount: number;
  };
  members: MemberSummary[];
  todayCount: number;
}
```

- [ ] **Step 2: 실패하는 규칙 테스트 작성**

`tests/rules.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  todayKST,
  stageOf,
  nextThreshold,
  sumPoints,
  REQUEST_POINTS,
  isCheckKind,
  isRequestKind,
} from "@/lib/rules";

describe("todayKST", () => {
  it("UTC 14:59는 아직 KST 같은 날", () => {
    expect(todayKST(new Date("2026-08-21T14:59:00Z"))).toBe("2026-08-21");
  });
  it("UTC 15:00은 KST 자정 → 다음 날", () => {
    expect(todayKST(new Date("2026-08-21T15:00:00Z"))).toBe("2026-08-22");
  });
  it("UTC 15:30 → KST 00:30 다음 날", () => {
    expect(todayKST(new Date("2026-08-21T15:30:00Z"))).toBe("2026-08-22");
  });
  it("연말 경계", () => {
    expect(todayKST(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});

describe("stageOf", () => {
  it.each([
    [0, 1],
    [199, 1],
    [200, 2],
    [399, 2],
    [400, 3],
    [699, 3],
    [700, 4],
    [999, 4],
    [1000, 5],
    [1500, 5],
  ])("total %i → stage %i", (total, stage) => {
    expect(stageOf(total)).toBe(stage);
  });
});

describe("nextThreshold", () => {
  it("다음 단계 기준점을 돌려준다", () => {
    expect(nextThreshold(0)).toBe(200);
    expect(nextThreshold(199)).toBe(200);
    expect(nextThreshold(200)).toBe(400);
    expect(nextThreshold(999)).toBe(1000);
  });
  it("결실 후에는 null", () => {
    expect(nextThreshold(1000)).toBeNull();
    expect(nextThreshold(1200)).toBeNull();
  });
});

describe("points", () => {
  it("요청 종류별 점수", () => {
    expect(REQUEST_POINTS.prayer).toBe(3);
    expect(REQUEST_POINTS.invite_remote).toBe(5);
    expect(REQUEST_POINTS.invite_face).toBe(7);
  });
  it("ledger 합산", () => {
    expect(
      sumPoints([
        { at: "", name: "a", kind: "bible", points: 1 },
        { at: "", name: "b", kind: "prayer", points: 3 },
        { at: "", name: "__dev__", kind: "adjust", points: -2 },
      ])
    ).toBe(2);
    expect(sumPoints([])).toBe(0);
  });
});

describe("kind guards", () => {
  it("체크 종류", () => {
    expect(isCheckKind("bible")).toBe(true);
    expect(isCheckKind("resolve")).toBe(true);
    expect(isCheckKind("prayer")).toBe(false);
    expect(isCheckKind(undefined)).toBe(false);
  });
  it("요청 종류", () => {
    expect(isRequestKind("prayer")).toBe(true);
    expect(isRequestKind("invite_remote")).toBe(true);
    expect(isRequestKind("invite_face")).toBe(true);
    expect(isRequestKind("bible")).toBe(false);
    expect(isRequestKind(3)).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
npm test -- tests/rules.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/rules'` 또는 유사한 해석 오류.

- [ ] **Step 4: 규칙 구현**

`lib/rules.ts`:
```ts
import type {
  CheckKind,
  LedgerEntry,
  LedgerKind,
  RequestKind,
  Stage,
} from "./types";

export const MAX_POINTS = 1000;
export const CHECK_POINTS = 1;

export const REQUEST_POINTS: Record<RequestKind, number> = {
  prayer: 3,
  invite_remote: 5,
  invite_face: 7,
};

/** 각 단계가 시작되는 점수. index 0 → 1단계 */
export const STAGE_THRESHOLDS = [0, 200, 400, 700, 1000] as const;

export const STAGE_INFO: Record<Stage, { title: string; caption: string }> = {
  1: { title: "햇빛 아래 씨앗", caption: "아직 땅에 심기지 않은 한 알의 밀" },
  2: { title: "땅에 심긴 씨앗", caption: "어둠 속에서 조용히 기다리는 중" },
  3: { title: "새싹이 돋았어요", caption: "흙을 뚫고 첫 잎이 올라왔어요" },
  4: { title: "자라나는 밀", caption: "푸른 줄기가 하늘을 향해 자라요" },
  5: { title: "결실한 밀", caption: "황금빛으로 여문 열매, 함께 이루었어요" },
};

export const KIND_LABEL: Record<LedgerKind, string> = {
  bible: "성경읽기",
  resolve: "다짐",
  prayer: "기도부탁",
  invite_remote: "비대면 권유",
  invite_face: "대면 권유",
  adjust: "조정",
};

const kstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 한국시간 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayKST(now: Date = new Date()): string {
  return kstFormatter.format(now);
}

export function stageOf(total: number): Stage {
  let stage = 1;
  STAGE_THRESHOLDS.forEach((threshold, index) => {
    if (total >= threshold) stage = index + 1;
  });
  return stage as Stage;
}

/** 다음 단계까지의 기준 점수. 결실(5단계) 이후에는 null */
export function nextThreshold(total: number): number | null {
  for (const threshold of STAGE_THRESHOLDS) {
    if (total < threshold) return threshold;
  }
  return null;
}

export function sumPoints(ledger: LedgerEntry[]): number {
  return ledger.reduce((acc, entry) => acc + entry.points, 0);
}

export function isCheckKind(x: unknown): x is CheckKind {
  return x === "bible" || x === "resolve";
}

export function isRequestKind(x: unknown): x is RequestKind {
  return x === "prayer" || x === "invite_remote" || x === "invite_face";
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test -- tests/rules.test.ts
```
Expected: 모든 테스트 PASS.

- [ ] **Step 6: 커밋**

```bash
git add lib/types.ts lib/rules.ts tests/rules.test.ts
git commit -m "feat: 공용 타입과 규칙(KST 날짜, 점수표, 단계 계산)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 3: 저장소 인터페이스와 메모리·파일 구현

**Files:**
- Create: `lib/store/types.ts`, `lib/store/memory.ts`, `lib/store/file.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Produces:
  - `Store { get<T>(key: string): Promise<T | null>; set<T>(key: string, value: T): Promise<void> }`
  - `createMemoryStore(): Store`
  - `createFileStore(dir: string): Store`

- [ ] **Step 1: 인터페이스 작성**

`lib/store/types.ts`:
```ts
/**
 * 키-값 JSON 저장소. 값은 JSON으로 직렬화 가능한 것이어야 한다.
 * 구현: memory(테스트), file(로컬), blob(배포)
 */
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}
```

- [ ] **Step 2: 실패하는 저장소 테스트 작성**

`tests/store.test.ts`:
```ts
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
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
npm test -- tests/store.test.ts
```
Expected: FAIL — 모듈을 찾을 수 없음.

- [ ] **Step 4: 메모리 저장소 구현**

`lib/store/memory.ts`:
```ts
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
```

- [ ] **Step 5: 파일 저장소 구현**

`lib/store/file.ts`:
```ts
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
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npm test -- tests/store.test.ts
```
Expected: 모든 테스트 PASS.

- [ ] **Step 7: 커밋**

```bash
git add lib/store tests/store.test.ts
git commit -m "feat: Store 인터페이스와 메모리·파일 저장소

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 4: 30명 명단과 로그인

**Files:**
- Create: `lib/members.ts`
- Create: `lib/service.ts` (login만)
- Test: `tests/members.test.ts`

**Interfaces:**
- Consumes: `Store`, `Member`
- Produces:
  - `SEED_MEMBERS: Member[]` (30명, 첫 번째가 관리자)
  - `ensureMembers(store): Promise<Member[]>` — 없으면 시드를 저장하고 돌려줌
  - `findMember(members, rawName): Member | null` — 공백 trim 후 정확 일치
  - `login(store, rawName): Promise<{ ok: true; name: string; isAdmin: boolean } | { ok: false }>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/members.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS, ensureMembers, findMember } from "@/lib/members";
import { login } from "@/lib/service";

describe("SEED_MEMBERS", () => {
  it("30명이고 관리자는 정확히 1명", () => {
    expect(SEED_MEMBERS).toHaveLength(30);
    expect(SEED_MEMBERS.filter((m) => m.isAdmin)).toHaveLength(1);
  });
  it("이름이 중복되지 않는다", () => {
    expect(new Set(SEED_MEMBERS.map((m) => m.name)).size).toBe(30);
  });
});

describe("ensureMembers", () => {
  it("비어 있으면 시드를 저장한다", async () => {
    const store = createMemoryStore();
    const members = await ensureMembers(store);
    expect(members).toEqual(SEED_MEMBERS);
    expect(await store.get("members")).toEqual(SEED_MEMBERS);
  });
  it("이미 있으면 저장된 것을 쓴다", async () => {
    const store = createMemoryStore();
    await store.set("members", [{ name: "테스트", isAdmin: true }]);
    expect(await ensureMembers(store)).toEqual([{ name: "테스트", isAdmin: true }]);
  });
});

describe("findMember", () => {
  const members = [
    { name: "김은혜", isAdmin: true },
    { name: "이주원", isAdmin: false },
  ];
  it("정확 일치", () => {
    expect(findMember(members, "이주원")).toEqual({ name: "이주원", isAdmin: false });
  });
  it("앞뒤 공백은 무시", () => {
    expect(findMember(members, "  김은혜 ")?.name).toBe("김은혜");
  });
  it("없는 이름·빈 문자열은 null", () => {
    expect(findMember(members, "홍길동")).toBeNull();
    expect(findMember(members, "")).toBeNull();
    expect(findMember(members, "   ")).toBeNull();
  });
});

describe("login", () => {
  it("명단에 있으면 ok와 관리자 여부", async () => {
    const store = createMemoryStore();
    const admin = SEED_MEMBERS.find((m) => m.isAdmin)!;
    const user = SEED_MEMBERS.find((m) => !m.isAdmin)!;
    expect(await login(store, admin.name)).toEqual({ ok: true, name: admin.name, isAdmin: true });
    expect(await login(store, user.name)).toEqual({ ok: true, name: user.name, isAdmin: false });
  });
  it("명단에 없으면 ok:false", async () => {
    expect(await login(createMemoryStore(), "홍길동")).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/members.test.ts
```
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 명단 구현**

`lib/members.ts`:
```ts
import type { Member } from "./types";
import type { Store } from "./store/types";

/** 테스트용 30명. 첫 번째가 관리자. 실제 운영 시 data/members.json을 고쳐 교체한다. */
export const SEED_MEMBERS: Member[] = [
  { name: "김은혜", isAdmin: true },
  { name: "이주원", isAdmin: false },
  { name: "박서준", isAdmin: false },
  { name: "최지우", isAdmin: false },
  { name: "정다은", isAdmin: false },
  { name: "강민준", isAdmin: false },
  { name: "조예린", isAdmin: false },
  { name: "윤도현", isAdmin: false },
  { name: "장서연", isAdmin: false },
  { name: "임태양", isAdmin: false },
  { name: "한소희", isAdmin: false },
  { name: "오승현", isAdmin: false },
  { name: "신유진", isAdmin: false },
  { name: "권지훈", isAdmin: false },
  { name: "황예은", isAdmin: false },
  { name: "안재민", isAdmin: false },
  { name: "송하린", isAdmin: false },
  { name: "전우진", isAdmin: false },
  { name: "홍수아", isAdmin: false },
  { name: "고준영", isAdmin: false },
  { name: "문채원", isAdmin: false },
  { name: "양시우", isAdmin: false },
  { name: "배나윤", isAdmin: false },
  { name: "백현우", isAdmin: false },
  { name: "허지안", isAdmin: false },
  { name: "남도윤", isAdmin: false },
  { name: "심예나", isAdmin: false },
  { name: "노건우", isAdmin: false },
  { name: "하윤서", isAdmin: false },
  { name: "구민재", isAdmin: false },
];

export async function ensureMembers(store: Store): Promise<Member[]> {
  const existing = await store.get<Member[]>("members");
  if (existing && existing.length > 0) return existing;
  await store.set("members", SEED_MEMBERS);
  return SEED_MEMBERS;
}

export function findMember(members: Member[], rawName: string): Member | null {
  const name = (rawName ?? "").trim();
  if (!name) return null;
  return members.find((m) => m.name === name) ?? null;
}
```

- [ ] **Step 4: service에 login 구현**

`lib/service.ts` (이 단계에서는 login만. 이후 Task에서 함수를 추가한다):
```ts
import type { Store } from "./store/types";
import { ensureMembers, findMember } from "./members";

export type LoginResult =
  | { ok: true; name: string; isAdmin: boolean }
  | { ok: false };

export async function login(store: Store, rawName: string): Promise<LoginResult> {
  const members = await ensureMembers(store);
  const member = findMember(members, rawName);
  if (!member) return { ok: false };
  return { ok: true, name: member.name, isAdmin: member.isAdmin };
}
```

- [ ] **Step 5: 통과 확인**

```bash
npm test -- tests/members.test.ts
```
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add lib/members.ts lib/service.ts tests/members.test.ts
git commit -m "feat: 30명 시드 명단과 이름 로그인

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 5: 상태 조회와 매일 체크

**Files:**
- Modify: `lib/service.ts`
- Test: `tests/service.test.ts`

**Interfaces:**
- Consumes: `Store`, `todayKST`, `stageOf`, `sumPoints`, `CHECK_POINTS`, `isCheckKind`, `ensureMembers`, `findMember`
- Produces:
  - `getState(store, rawName, now?): Promise<FieldState | null>`
  - `check(store, rawName, kind, now?): Promise<{ ok: true } | { ok: false; reason: "bad_kind" | "unknown_member" | "already" }>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/service.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import type { Store } from "@/lib/store/types";
import { createMemoryStore } from "@/lib/store/memory";
import { SEED_MEMBERS } from "@/lib/members";
import { getState, check } from "@/lib/service";

const ADMIN = SEED_MEMBERS.find((m) => m.isAdmin)!.name;
const USER = SEED_MEMBERS.find((m) => !m.isAdmin)!.name;
const OTHER = SEED_MEMBERS.filter((m) => !m.isAdmin)[1].name;

// KST 2026-08-21 10:00
const DAY1 = new Date("2026-08-21T01:00:00Z");
// KST 2026-08-21 23:59
const DAY1_LATE = new Date("2026-08-21T14:59:00Z");
// KST 2026-08-22 00:00
const DAY2 = new Date("2026-08-21T15:00:00Z");

describe("getState", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("명단 외 이름은 null", async () => {
    expect(await getState(store, "홍길동", DAY1)).toBeNull();
  });

  it("초기 상태는 0점 1단계, 30명 모두 0점", async () => {
    const s = (await getState(store, USER, DAY1))!;
    expect(s.today).toBe("2026-08-21");
    expect(s.total).toBe(0);
    expect(s.stage).toBe(1);
    expect(s.me).toEqual({ name: USER, isAdmin: false, bible: false, resolve: false, pendingCount: 0 });
    expect(s.members).toHaveLength(30);
    expect(s.members.every((m) => m.points === 0 && !m.bible && !m.resolve)).toBe(true);
    expect(s.todayCount).toBe(0);
  });

  it("관리자는 isAdmin true", async () => {
    expect((await getState(store, ADMIN, DAY1))!.me.isAdmin).toBe(true);
  });
});

describe("check", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("잘못된 종류는 거부", async () => {
    expect(await check(store, USER, "prayer" as never, DAY1)).toEqual({ ok: false, reason: "bad_kind" });
  });

  it("명단 외 이름은 거부", async () => {
    expect(await check(store, "홍길동", "bible", DAY1)).toEqual({ ok: false, reason: "unknown_member" });
  });

  it("성경·다짐 각각 1점, 상태에 반영", async () => {
    expect(await check(store, USER, "bible", DAY1)).toEqual({ ok: true });
    let s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(1);
    expect(s.me.bible).toBe(true);
    expect(s.me.resolve).toBe(false);

    expect(await check(store, USER, "resolve", DAY1)).toEqual({ ok: true });
    s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(2);
    expect(s.me.resolve).toBe(true);
    expect(s.members.find((m) => m.name === USER)!.points).toBe(2);
    expect(s.todayCount).toBe(1);
  });

  it("같은 날 같은 항목은 두 번 못 한다", async () => {
    await check(store, USER, "bible", DAY1);
    expect(await check(store, USER, "bible", DAY1_LATE)).toEqual({ ok: false, reason: "already" });
    expect((await getState(store, USER, DAY1_LATE))!.total).toBe(1);
  });

  it("다음 날(KST 자정)이면 다시 할 수 있다", async () => {
    await check(store, USER, "bible", DAY1);
    expect(await check(store, USER, "bible", DAY2)).toEqual({ ok: true });
    const s = (await getState(store, USER, DAY2))!;
    expect(s.total).toBe(2);
    expect(s.today).toBe("2026-08-22");
    expect(s.me.bible).toBe(true); // 오늘(DAY2) 기준
  });

  it("서로 다른 사람의 체크는 독립이고 총점은 합산", async () => {
    await check(store, USER, "bible", DAY1);
    await check(store, OTHER, "bible", DAY1);
    await check(store, OTHER, "resolve", DAY1);
    const s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(3);
    expect(s.todayCount).toBe(2);
    expect(s.members.find((m) => m.name === OTHER)).toEqual({ name: OTHER, points: 2, bible: true, resolve: true });
  });

  it("이름 앞뒤 공백은 같은 사람으로 본다", async () => {
    await check(store, ` ${USER} `, "bible", DAY1);
    expect(await check(store, USER, "bible", DAY1)).toEqual({ ok: false, reason: "already" });
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/service.test.ts
```
Expected: FAIL — `getState`, `check`가 export되지 않음.

- [ ] **Step 3: service에 getState와 check 추가**

`lib/service.ts`를 아래 전체 내용으로 교체:
```ts
import type { Store } from "./store/types";
import type {
  CheckKind,
  Checks,
  DayCheck,
  FieldState,
  LedgerEntry,
  MemberSummary,
  PendingRequest,
} from "./types";
import { ensureMembers, findMember } from "./members";
import {
  CHECK_POINTS,
  isCheckKind,
  stageOf,
  sumPoints,
  todayKST,
} from "./rules";

// ── 읽기 헬퍼 ───────────────────────────────────────────────

const EMPTY_DAY: DayCheck = { bible: false, resolve: false };

async function getChecks(store: Store, name: string): Promise<Checks> {
  return (await store.get<Checks>(`checks/${name}`)) ?? {};
}

async function getLedger(store: Store): Promise<LedgerEntry[]> {
  return (await store.get<LedgerEntry[]>("ledger")) ?? [];
}

async function getRequests(store: Store): Promise<PendingRequest[]> {
  return (await store.get<PendingRequest[]>("requests")) ?? [];
}

async function appendLedger(store: Store, entry: LedgerEntry): Promise<LedgerEntry[]> {
  const ledger = await getLedger(store);
  ledger.push(entry);
  await store.set("ledger", ledger);
  return ledger;
}

// ── 로그인 ──────────────────────────────────────────────────

export type LoginResult =
  | { ok: true; name: string; isAdmin: boolean }
  | { ok: false };

export async function login(store: Store, rawName: string): Promise<LoginResult> {
  const members = await ensureMembers(store);
  const member = findMember(members, rawName);
  if (!member) return { ok: false };
  return { ok: true, name: member.name, isAdmin: member.isAdmin };
}

// ── 상태 조회 ───────────────────────────────────────────────

export async function getState(
  store: Store,
  rawName: string,
  now: Date = new Date()
): Promise<FieldState | null> {
  const members = await ensureMembers(store);
  const me = findMember(members, rawName);
  if (!me) return null;

  const today = todayKST(now);
  const [ledger, requests] = await Promise.all([getLedger(store), getRequests(store)]);

  const pointsByName = new Map<string, number>();
  for (const entry of ledger) {
    pointsByName.set(entry.name, (pointsByName.get(entry.name) ?? 0) + entry.points);
  }

  const summaries: MemberSummary[] = await Promise.all(
    members.map(async (m) => {
      const day = (await getChecks(store, m.name))[today] ?? EMPTY_DAY;
      return {
        name: m.name,
        points: pointsByName.get(m.name) ?? 0,
        bible: day.bible,
        resolve: day.resolve,
      };
    })
  );

  const total = sumPoints(ledger);
  const mine = summaries.find((s) => s.name === me.name)!;

  return {
    today,
    total,
    stage: stageOf(total),
    me: {
      name: me.name,
      isAdmin: me.isAdmin,
      bible: mine.bible,
      resolve: mine.resolve,
      pendingCount: requests.filter((r) => r.name === me.name).length,
    },
    members: summaries,
    todayCount: summaries.filter((s) => s.bible || s.resolve).length,
  };
}

// ── 매일 체크 ───────────────────────────────────────────────

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: "bad_kind" | "unknown_member" | "already" };

export async function check(
  store: Store,
  rawName: string,
  kind: CheckKind,
  now: Date = new Date()
): Promise<CheckResult> {
  if (!isCheckKind(kind)) return { ok: false, reason: "bad_kind" };
  const members = await ensureMembers(store);
  const me = findMember(members, rawName);
  if (!me) return { ok: false, reason: "unknown_member" };

  const today = todayKST(now);
  const checks = await getChecks(store, me.name);
  const day = checks[today] ?? EMPTY_DAY;
  if (day[kind]) return { ok: false, reason: "already" };

  checks[today] = { ...day, [kind]: true };
  await store.set(`checks/${me.name}`, checks);
  await appendLedger(store, {
    at: now.toISOString(),
    name: me.name,
    kind,
    points: CHECK_POINTS,
  });
  return { ok: true };
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test
```
Expected: rules, store, members, service 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/service.ts tests/service.test.ts
git commit -m "feat: 밭 상태 조회와 하루 1회 체크(KST)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 6: 요청, 승인/거절, 개발용 점수 조정

**Files:**
- Modify: `lib/service.ts`
- Modify: `tests/service.test.ts` (추가)

**Interfaces:**
- Consumes: `REQUEST_POINTS`, `isRequestKind`, `PendingRequest`
- Produces:
  - `addRequest(store, rawName, kind, now?): Promise<{ ok: true; pendingCount: number } | { ok: false; reason: "bad_kind" | "unknown_member" }>`
  - `listRequests(store, adminRawName): Promise<PendingRequest[] | null>` — 관리자 아니면 null
  - `decide(store, adminRawName, id, approve, now?): Promise<{ ok: true; total: number } | { ok: false; reason: "forbidden" | "not_found" }>`
  - `recentLedger(store, limit): Promise<LedgerEntry[]>` — 최신순
  - `setTotalDev(store, adminRawName, target, now?): Promise<{ ok: true; total: number } | { ok: false; reason: "forbidden" }>`

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/service.test.ts` 맨 아래에 추가 (import 줄도 갱신):
```ts
// import 줄을 다음으로 교체
// import { getState, check, addRequest, listRequests, decide, recentLedger, setTotalDev } from "@/lib/service";

describe("requests & decide", () => {
  let store: Store;
  beforeEach(() => {
    store = createMemoryStore();
  });

  it("잘못된 종류·명단 외 이름은 거부", async () => {
    expect(await addRequest(store, USER, "bible" as never, DAY1)).toEqual({ ok: false, reason: "bad_kind" });
    expect(await addRequest(store, "홍길동", "prayer", DAY1)).toEqual({ ok: false, reason: "unknown_member" });
  });

  it("요청은 제한 없이 쌓이고 대기 수가 늘어난다", async () => {
    expect(await addRequest(store, USER, "prayer", DAY1)).toEqual({ ok: true, pendingCount: 1 });
    expect(await addRequest(store, USER, "prayer", DAY1)).toEqual({ ok: true, pendingCount: 2 });
    expect(await addRequest(store, USER, "invite_face", DAY1)).toEqual({ ok: true, pendingCount: 3 });
    expect((await getState(store, USER, DAY1))!.me.pendingCount).toBe(3);
    expect((await getState(store, USER, DAY1))!.total).toBe(0); // 아직 미반영
  });

  it("비관리자는 목록을 볼 수 없다", async () => {
    await addRequest(store, USER, "prayer", DAY1);
    expect(await listRequests(store, USER)).toBeNull();
    expect(await listRequests(store, "홍길동")).toBeNull();
  });

  it("관리자는 요청자 이름·종류·시각을 본다", async () => {
    await addRequest(store, USER, "prayer", DAY1);
    await addRequest(store, OTHER, "invite_remote", DAY1_LATE);
    const list = (await listRequests(store, ADMIN))!;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: USER, kind: "prayer", requestedAt: DAY1.toISOString() });
    expect(list[1]).toMatchObject({ name: OTHER, kind: "invite_remote" });
    expect(typeof list[0].id).toBe("string");
    expect(list[0].id).not.toBe(list[1].id);
  });

  it("승인하면 종류별 점수가 요청자 이름으로 반영되고 목록에서 사라진다", async () => {
    await addRequest(store, USER, "prayer", DAY1);
    await addRequest(store, USER, "invite_remote", DAY1);
    await addRequest(store, OTHER, "invite_face", DAY1);
    const [r1, r2, r3] = (await listRequests(store, ADMIN))!;

    expect(await decide(store, ADMIN, r1.id, true, DAY1)).toEqual({ ok: true, total: 3 });
    expect(await decide(store, ADMIN, r2.id, true, DAY1)).toEqual({ ok: true, total: 8 });
    expect(await decide(store, ADMIN, r3.id, true, DAY1)).toEqual({ ok: true, total: 15 });

    expect(await listRequests(store, ADMIN)).toEqual([]);
    const s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(15);
    expect(s.me.pendingCount).toBe(0);
    expect(s.members.find((m) => m.name === USER)!.points).toBe(8);
    expect(s.members.find((m) => m.name === OTHER)!.points).toBe(7);
  });

  it("거절하면 0점이고 목록에서만 사라진다", async () => {
    await addRequest(store, USER, "invite_face", DAY1);
    const [r] = (await listRequests(store, ADMIN))!;
    expect(await decide(store, ADMIN, r.id, false, DAY1)).toEqual({ ok: true, total: 0 });
    expect(await listRequests(store, ADMIN)).toEqual([]);
    expect((await getState(store, USER, DAY1))!.total).toBe(0);
  });

  it("비관리자는 승인할 수 없다", async () => {
    await addRequest(store, USER, "prayer", DAY1);
    const [r] = (await listRequests(store, ADMIN))!;
    expect(await decide(store, USER, r.id, true, DAY1)).toEqual({ ok: false, reason: "forbidden" });
    expect(await listRequests(store, ADMIN)).toHaveLength(1);
  });

  it("없는 id는 not_found", async () => {
    expect(await decide(store, ADMIN, "nope", true, DAY1)).toEqual({ ok: false, reason: "not_found" });
  });

  it("recentLedger는 최신순으로 limit만큼", async () => {
    await check(store, USER, "bible", DAY1);
    await check(store, OTHER, "bible", DAY1_LATE);
    const recent = await recentLedger(store, 1);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ name: OTHER, kind: "bible" });
  });
});

describe("setTotalDev", () => {
  it("관리자만, 총점을 목표값으로 맞추는 adjust 항목을 추가한다", async () => {
    const store = createMemoryStore();
    await check(store, USER, "bible", DAY1); // total 1
    expect(await setTotalDev(store, USER, 400, DAY1)).toEqual({ ok: false, reason: "forbidden" });
    expect(await setTotalDev(store, ADMIN, 400, DAY1)).toEqual({ ok: true, total: 400 });
    let s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(400);
    expect(s.stage).toBe(3);
    // 개인 기여 점수는 건드리지 않는다
    expect(s.members.find((m) => m.name === USER)!.points).toBe(1);
    // 내려가는 조정도 가능
    expect(await setTotalDev(store, ADMIN, 0, DAY1)).toEqual({ ok: true, total: 0 });
    s = (await getState(store, USER, DAY1))!;
    expect(s.total).toBe(0);
    expect(s.stage).toBe(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- tests/service.test.ts
```
Expected: FAIL — 새 함수들이 export되지 않음.

- [ ] **Step 3: service에 함수 추가**

`lib/service.ts`의 import를 갱신하고 파일 끝에 추가:

import 변경:
```ts
import { randomUUID } from "node:crypto";
import type { Store } from "./store/types";
import type {
  CheckKind,
  Checks,
  DayCheck,
  FieldState,
  LedgerEntry,
  MemberSummary,
  PendingRequest,
  RequestKind,
} from "./types";
import { ensureMembers, findMember } from "./members";
import {
  CHECK_POINTS,
  REQUEST_POINTS,
  isCheckKind,
  isRequestKind,
  stageOf,
  sumPoints,
  todayKST,
} from "./rules";
```

파일 끝에 추가:
```ts
// ── 요청 ────────────────────────────────────────────────────

export type AddRequestResult =
  | { ok: true; pendingCount: number }
  | { ok: false; reason: "bad_kind" | "unknown_member" };

export async function addRequest(
  store: Store,
  rawName: string,
  kind: RequestKind,
  now: Date = new Date()
): Promise<AddRequestResult> {
  if (!isRequestKind(kind)) return { ok: false, reason: "bad_kind" };
  const members = await ensureMembers(store);
  const me = findMember(members, rawName);
  if (!me) return { ok: false, reason: "unknown_member" };

  const requests = await getRequests(store);
  requests.push({
    id: randomUUID(),
    name: me.name,
    kind,
    requestedAt: now.toISOString(),
  });
  await store.set("requests", requests);
  return {
    ok: true,
    pendingCount: requests.filter((r) => r.name === me.name).length,
  };
}

async function requireAdmin(store: Store, rawName: string): Promise<string | null> {
  const members = await ensureMembers(store);
  const member = findMember(members, rawName);
  return member?.isAdmin ? member.name : null;
}

/** 관리자가 아니면 null */
export async function listRequests(
  store: Store,
  adminRawName: string
): Promise<PendingRequest[] | null> {
  if (!(await requireAdmin(store, adminRawName))) return null;
  return getRequests(store);
}

export type DecideResult =
  | { ok: true; total: number }
  | { ok: false; reason: "forbidden" | "not_found" };

export async function decide(
  store: Store,
  adminRawName: string,
  id: string,
  approve: boolean,
  now: Date = new Date()
): Promise<DecideResult> {
  if (!(await requireAdmin(store, adminRawName))) return { ok: false, reason: "forbidden" };

  const requests = await getRequests(store);
  const index = requests.findIndex((r) => r.id === id);
  if (index < 0) return { ok: false, reason: "not_found" };

  const [target] = requests.splice(index, 1);
  await store.set("requests", requests);

  let ledger = await getLedger(store);
  if (approve) {
    ledger = await appendLedger(store, {
      at: now.toISOString(),
      name: target.name,
      kind: target.kind,
      points: REQUEST_POINTS[target.kind],
    });
  }
  return { ok: true, total: sumPoints(ledger) };
}

/** 최근 반영 기록, 최신순 */
export async function recentLedger(store: Store, limit: number): Promise<LedgerEntry[]> {
  const ledger = await getLedger(store);
  return ledger.slice(-limit).reverse();
}

// ── 개발 전용: 단계 확인용 총점 조정 ────────────────────────

export const DEV_ADJUST_NAME = "__dev__";

export type SetTotalResult =
  | { ok: true; total: number }
  | { ok: false; reason: "forbidden" };

export async function setTotalDev(
  store: Store,
  adminRawName: string,
  target: number,
  now: Date = new Date()
): Promise<SetTotalResult> {
  if (!(await requireAdmin(store, adminRawName))) return { ok: false, reason: "forbidden" };
  const current = sumPoints(await getLedger(store));
  const ledger = await appendLedger(store, {
    at: now.toISOString(),
    name: DEV_ADJUST_NAME,
    kind: "adjust",
    points: target - current,
  });
  return { ok: true, total: sumPoints(ledger) };
}
```

- [ ] **Step 4: 통과 확인**

```bash
npm test
```
Expected: 전체 PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/service.ts tests/service.test.ts
git commit -m "feat: 기도부탁·권유 요청과 관리자 승인/거절, 개발용 점수 조정

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 7: Store 선택과 API 라우트

**Files:**
- Create: `lib/store/blob.ts`, `lib/store/index.ts`, `lib/api.ts`
- Create: `app/api/login/route.ts`, `app/api/state/route.ts`, `app/api/check/route.ts`, `app/api/request/route.ts`, `app/api/admin/requests/route.ts`, `app/api/admin/decide/route.ts`, `app/api/dev/set-total/route.ts`

**Interfaces:**
- Consumes: Task 4–6의 service 함수 전부
- Produces:
  - `getStore(): Store` — `BLOB_READ_WRITE_TOKEN`이 있으면 Blob, 아니면 `<cwd>/data` 파일 저장소. 프로세스 내 싱글턴
  - HTTP 계약 (스펙 §6):
    - `POST /api/login {name}` → 200 `{ok:true,name,isAdmin}` | 404 `{ok:false,error}`
    - `GET /api/state?name=` → 200 `FieldState` | 404
    - `POST /api/check {name,kind}` → 200 `FieldState` | 409 `{error:"already"}` | 400 | 404
    - `POST /api/request {name,kind}` → 200 `{ok:true,pendingCount}` | 400 | 404
    - `GET /api/admin/requests?name=` → 200 `PendingRequest[]` | 403
    - `POST /api/admin/decide {name,id,approve}` → 200 `{ok:true,total}` | 403 | 404
    - `POST /api/dev/set-total {name,total}` → 200 `{ok:true,total}` | 403 | 404(production)

- [ ] **Step 1: Blob 저장소와 선택기 작성**

`lib/store/blob.ts`:
```ts
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
```

`lib/store/index.ts`:
```ts
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
```

- [ ] **Step 2: 라우트 헬퍼 작성**

`lib/api.ts`:
```ts
import { NextResponse } from "next/server";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** 본문이 JSON이 아니면 빈 객체 */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
```

- [ ] **Step 3: 라우트 작성**

`app/api/login/route.ts`:
```ts
import { getStore } from "@/lib/store";
import { login } from "@/lib/service";
import { error, json, readJson } from "@/lib/api";

export async function POST(req: Request) {
  const { name } = await readJson(req);
  const result = await login(getStore(), String(name ?? ""));
  if (!result.ok) return error("명단에 없는 이름입니다", 404);
  return json(result);
}
```

`app/api/state/route.ts`:
```ts
import { getStore } from "@/lib/store";
import { getState } from "@/lib/service";
import { error, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const state = await getState(getStore(), name);
  if (!state) return error("명단에 없는 이름입니다", 404);
  return json(state);
}
```

`app/api/check/route.ts`:
```ts
import { getStore } from "@/lib/store";
import { check, getState } from "@/lib/service";
import { error, json, readJson } from "@/lib/api";
import type { CheckKind } from "@/lib/types";

export async function POST(req: Request) {
  const { name, kind } = await readJson(req);
  const store = getStore();
  const result = await check(store, String(name ?? ""), kind as CheckKind);
  if (!result.ok) {
    if (result.reason === "bad_kind") return error("잘못된 항목입니다", 400);
    if (result.reason === "unknown_member") return error("명단에 없는 이름입니다", 404);
    return error("already", 409);
  }
  const state = await getState(store, String(name));
  return json(state);
}
```

`app/api/request/route.ts`:
```ts
import { getStore } from "@/lib/store";
import { addRequest } from "@/lib/service";
import { error, json, readJson } from "@/lib/api";
import type { RequestKind } from "@/lib/types";

export async function POST(req: Request) {
  const { name, kind } = await readJson(req);
  const result = await addRequest(getStore(), String(name ?? ""), kind as RequestKind);
  if (!result.ok) {
    if (result.reason === "bad_kind") return error("잘못된 요청 종류입니다", 400);
    return error("명단에 없는 이름입니다", 404);
  }
  return json(result);
}
```

`app/api/admin/requests/route.ts`:
```ts
import { getStore } from "@/lib/store";
import { listRequests } from "@/lib/service";
import { error, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const list = await listRequests(getStore(), name);
  if (!list) return error("관리자만 볼 수 있습니다", 403);
  return json(list);
}
```

`app/api/admin/decide/route.ts`:
```ts
import { getStore } from "@/lib/store";
import { decide } from "@/lib/service";
import { error, json, readJson } from "@/lib/api";

export async function POST(req: Request) {
  const { name, id, approve } = await readJson(req);
  const result = await decide(getStore(), String(name ?? ""), String(id ?? ""), approve === true);
  if (!result.ok) {
    if (result.reason === "forbidden") return error("관리자만 처리할 수 있습니다", 403);
    return error("이미 처리됐거나 없는 요청입니다", 404);
  }
  return json(result);
}
```

`app/api/dev/set-total/route.ts`:
```ts
import { getStore } from "@/lib/store";
import { setTotalDev } from "@/lib/service";
import { error, isProduction, json, readJson } from "@/lib/api";

export async function POST(req: Request) {
  if (isProduction()) return error("not found", 404);
  const { name, total } = await readJson(req);
  const target = Number(total);
  if (!Number.isFinite(target)) return error("total은 숫자여야 합니다", 400);
  const result = await setTotalDev(getStore(), String(name ?? ""), target);
  if (!result.ok) return error("관리자만 조정할 수 있습니다", 403);
  return json(result);
}
```

- [ ] **Step 4: 타입 검사와 curl 스모크 테스트**

```bash
npx tsc --noEmit
```
Expected: 오류 없음.

```bash
rm -rf data
npm run dev > /tmp/milal-dev.log 2>&1 &
sleep 6
B=http://localhost:3000

echo "--- 명단 외 로그인 → 404"
curl -s -w " [%{http_code}]\n" -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"홍길동"}'
echo "--- 일반 로그인 → 200 isAdmin false"
curl -s -w " [%{http_code}]\n" -X POST $B/api/login -H 'content-type: application/json' -d '{"name":"이주원"}'
echo "--- 성경 체크 → 200, total 1"
curl -s -X POST $B/api/check -H 'content-type: application/json' -d '{"name":"이주원","kind":"bible"}' | head -c 120; echo
echo "--- 같은 체크 → 409"
curl -s -w " [%{http_code}]\n" -X POST $B/api/check -H 'content-type: application/json' -d '{"name":"이주원","kind":"bible"}'
echo "--- 요청 → pendingCount 1"
curl -s -w " [%{http_code}]\n" -X POST $B/api/request -H 'content-type: application/json' -d '{"name":"이주원","kind":"invite_face"}'
echo "--- 비관리자 목록 → 403"
curl -s -w " [%{http_code}]\n" "$B/api/admin/requests?name=이주원"
echo "--- 관리자 목록 → 200"
curl -s "$B/api/admin/requests?name=김은혜"; echo
ID=$(curl -s "$B/api/admin/requests?name=김은혜" | sed -E 's/.*"id":"([^"]+)".*/\1/')
echo "--- 승인 → total 8"
curl -s -w " [%{http_code}]\n" -X POST $B/api/admin/decide -H 'content-type: application/json' -d "{\"name\":\"김은혜\",\"id\":\"$ID\",\"approve\":true}"
echo "--- 개발용 조정 → total 700"
curl -s -w " [%{http_code}]\n" -X POST $B/api/dev/set-total -H 'content-type: application/json' -d '{"name":"김은혜","total":700}'
echo "--- 상태 → stage 4"
curl -s "$B/api/state?name=이주원" | head -c 100; echo
echo "--- data 폴더"
ls data
kill %1
```
Expected: 주석에 적힌 상태 코드·값. `data/`에 `members.json`, `checks__이주원.json`, `requests.json`, `ledger.json`이 보인다.

- [ ] **Step 5: 커밋**

```bash
git add lib/store/blob.ts lib/store/index.ts lib/api.ts app/api
git commit -m "feat: 저장소 선택기와 API 라우트

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 8: 레이아웃, 전역 스타일, 클라이언트 헬퍼, 입장 화면

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`
- Create: `lib/client.ts`
- Modify: `app/page.tsx` (입장 화면으로 교체)
- Delete: `public/*.svg` 중 Next 기본 로고 파일 (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`)

**Interfaces:**
- Produces:
  - `lib/client.ts`: `NAME_KEY`, `getSavedName()`, `saveName(name)`, `clearName()`, `api<T>(path, init?)` → `{ status, data }`
  - 전역 CSS 클래스: `.card`, `.btn`, `.btn-primary`, `.btn-ghost`, 애니메이션 `sway`, `twinkle`, `pop`, `fade-up`

- [ ] **Step 1: 전역 스타일**

`app/globals.css` 전체 교체:
```css
@import "tailwindcss";

:root {
  --soil: #7c4a2d;
  --soil-light: #a66a43;
  --wheat: #e0a53a;
  --wheat-deep: #b97a1e;
  --leaf: #5aa84a;
  --leaf-deep: #2f7a3a;
  --sky: #cfe8ff;
  --cream: #fff8ec;
  --ink: #3b2a1e;
  --muted: #8a7461;
}

html,
body {
  height: 100%;
}

body {
  font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,
    system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(1200px 600px at 50% -200px, #fff3d6 0%, transparent 70%),
    linear-gradient(180deg, #f7efe2 0%, #efe3cf 100%);
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
}

.card {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(124, 74, 45, 0.1);
  border-radius: 1.25rem;
  box-shadow: 0 10px 30px -18px rgba(59, 42, 30, 0.35);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 1rem;
  font-weight: 600;
  padding: 0.9rem 1.1rem;
  transition: transform 0.08s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  touch-action: manipulation;
  user-select: none;
}
.btn:active:not(:disabled) {
  transform: scale(0.97);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-primary {
  background: linear-gradient(180deg, var(--wheat) 0%, var(--wheat-deep) 100%);
  color: #fff;
  box-shadow: 0 8px 18px -8px rgba(185, 122, 30, 0.7);
}
.btn-ghost {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(124, 74, 45, 0.18);
  color: var(--ink);
}
.btn-done {
  background: #eef7ea;
  border: 1px solid #cfe7c8;
  color: var(--leaf-deep);
}

@keyframes sway {
  0%, 100% { transform: rotate(-1.6deg); }
  50% { transform: rotate(1.6deg); }
}
@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.15); }
}
@keyframes pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes float-up {
  0% { opacity: 0; transform: translateY(0); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-28px); }
}

.sway { animation: sway 4.5s ease-in-out infinite; transform-origin: 50% 100%; transform-box: fill-box; }
.twinkle { animation: twinkle 2.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
.pop { animation: pop 0.4s ease-out; }
.fade-up { animation: fade-up 0.45s ease-out both; }
.float-up { animation: float-up 1.1s ease-out forwards; }

@media (prefers-reduced-motion: reduce) {
  .sway, .twinkle, .pop, .fade-up, .float-up { animation: none; }
}
```

- [ ] **Step 2: 레이아웃**

`app/layout.tsx` 전체 교체:
```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "밀알",
  description: "한 알의 밀이 땅에 떨어져 — 함께 키우는 공동체 밀알",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7efe2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <div className="mx-auto w-full max-w-md min-h-dvh px-4 pb-10">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 클라이언트 헬퍼**

`lib/client.ts`:
```ts
export const NAME_KEY = "milal.name";

export function getSavedName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function saveName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // 저장 불가 환경(시크릿 모드 등)에서는 조용히 무시
  }
}

export function clearName(): void {
  try {
    window.localStorage.removeItem(NAME_KEY);
  } catch {
    // ignore
  }
}

export async function api<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown }
): Promise<{ status: number; data: T }> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }
  return { status: res.status, data };
}
```

- [ ] **Step 4: 입장 화면**

`app/page.tsx` 전체 교체:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getSavedName, saveName } from "@/lib/client";
import { SEED_MEMBERS } from "@/lib/members";

export default function EnterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (getSavedName()) router.replace("/field");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { status, data } = await api<{ ok: boolean; name?: string }>("/api/login", {
      method: "POST",
      body: { name },
    });
    setBusy(false);
    if (status === 200 && data.ok && data.name) {
      saveName(data.name);
      router.replace("/field");
    } else {
      setError("명단에 없는 이름입니다");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 py-12">
      <div className="text-center fade-up">
        <div className="mx-auto mb-5 h-24 w-24 rounded-full bg-gradient-to-b from-[#ffe6a8] to-[#e0a53a] shadow-[0_20px_40px_-20px_rgba(185,122,30,0.8)]" />
        <h1 className="text-4xl font-extrabold tracking-tight">밀알</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          한 알의 밀이 땅에 떨어져 죽으면
          <br />
          많은 열매를 맺느니라 — 요한복음 12:24
        </p>
      </div>

      <form onSubmit={submit} className="card w-full p-5 fade-up" style={{ animationDelay: "80ms" }}>
        <label className="block text-sm font-semibold text-[var(--muted)]" htmlFor="name">
          이름
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="명단에 있는 이름을 입력하세요"
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-[rgba(124,74,45,0.18)] bg-white px-4 py-3 text-base outline-none focus:border-[var(--wheat)] focus:ring-2 focus:ring-[rgba(224,165,58,0.25)]"
        />
        {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !name.trim()} className="btn btn-primary mt-4 w-full text-base">
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>

      {isDev && (
        <div className="w-full text-center text-xs text-[var(--muted)]">
          <button type="button" onClick={() => setShowList((v) => !v)} className="underline">
            테스트 명단 {showList ? "숨기기" : "보기"}
          </button>
          {showList && (
            <div className="card mt-3 grid grid-cols-3 gap-1 p-3 text-left">
              {SEED_MEMBERS.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setName(m.name)}
                  className="rounded-lg px-2 py-1 hover:bg-[#fff3d6]"
                >
                  {m.name}
                  {m.isAdmin && " ⭐"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Next 기본 에셋 제거 후 확인**

```bash
rm -f public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
npx tsc --noEmit && npm run lint
```
Expected: 오류 없음.

```bash
npm run dev > /tmp/milal-dev.log 2>&1 &
sleep 6
curl -s http://localhost:3000 | grep -o "들어가기" | head -1
kill %1
```
Expected: `들어가기`.

브라우저로 `http://localhost:3000` 열어 확인: 제목·구절·입력칸이 보이고, "테스트 명단 보기"를 누르면 30명이 나열되며 ⭐가 붙은 이름이 하나다. "홍길동" 입력 → 빨간 오류. 명단의 이름 입력 → `/field`로 이동(아직 404 — 다음 Task).

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: 레이아웃·전역 스타일·입장 화면

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 9: 밀알 장면 SVG와 개발용 미리보기

**Files:**
- Create: `components/WheatScene.tsx`
- Create: `app/dev/scene/page.tsx`

**Interfaces:**
- Produces: `<WheatScene stage={1|2|3|4|5} className? />` — `viewBox 0 0 360 300`, 가로 100% 반응형

- [ ] **Step 1: 장면 컴포넌트 작성**

`components/WheatScene.tsx`:
```tsx
import type { Stage } from "@/lib/types";

type Palette = {
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunGlow: string;
  hillFar: string;
  hillNear: string;
  ground: string;
};

const PALETTE: Record<Stage, Palette> = {
  1: { skyTop: "#cfe6ff", skyBottom: "#fff3cf", sun: "#ffd34d", sunGlow: "#fff0b3", hillFar: "#d9c39a", hillNear: "#c9a877", ground: "#c79a63" },
  2: { skyTop: "#bfdcff", skyBottom: "#eaf4ff", sun: "#ffdb6e", sunGlow: "#fff4c7", hillFar: "#b9c79a", hillNear: "#9db57f", ground: "#8a5a36" },
  3: { skyTop: "#a9d3ff", skyBottom: "#ecf8ff", sun: "#ffe07a", sunGlow: "#fff7d6", hillFar: "#a9cc8c", hillNear: "#86b86c", ground: "#7c4a2d" },
  4: { skyTop: "#8fc4ff", skyBottom: "#e6f5ff", sun: "#ffe58a", sunGlow: "#fff9e0", hillFar: "#93c27a", hillNear: "#6fae5a", ground: "#6f4226" },
  5: { skyTop: "#ff9f6e", skyBottom: "#ffe2a8", sun: "#ffb347", sunGlow: "#ffd89a", hillFar: "#d8a85a", hillNear: "#c28b3a", ground: "#6a3f22" },
};

const SUN_POS: Record<Stage, { cx: number; cy: number; r: number }> = {
  1: { cx: 290, cy: 62, r: 34 },
  2: { cx: 280, cy: 70, r: 28 },
  3: { cx: 270, cy: 64, r: 28 },
  4: { cx: 262, cy: 58, r: 30 },
  5: { cx: 250, cy: 92, r: 40 },
};

function Seed({ x, y, rotate = -18, scale = 1 }: { x: number; y: number; rotate?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="14" ry="8.5" fill="url(#seedGrad)" stroke="#8c5a1e" strokeWidth="1.2" />
      <path d="M -11 0 Q 0 -4 11 0" stroke="#8c5a1e" strokeWidth="1.1" fill="none" opacity="0.8" />
      <ellipse cx="-4" cy="-3" rx="4" ry="1.6" fill="#ffe7b0" opacity="0.7" />
    </g>
  );
}

function Sprout() {
  return (
    <g className="sway">
      <path d="M 180 228 C 180 212, 181 198, 180 182" stroke="#4d9a3e" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M 180 204 C 160 200, 150 186, 152 172 C 168 174, 180 188, 180 204 Z" fill="url(#leafGrad)" />
      <path d="M 180 196 C 200 190, 212 176, 210 160 C 194 163, 181 178, 180 196 Z" fill="url(#leafGrad)" />
      <path d="M 180 204 C 168 196, 160 186, 154 174" stroke="#2f7a3a" strokeWidth="1" fill="none" opacity="0.5" />
      <path d="M 180 196 C 192 188, 202 176, 208 163" stroke="#2f7a3a" strokeWidth="1" fill="none" opacity="0.5" />
    </g>
  );
}

function Stalk({ x, height, golden, delay = 0 }: { x: number; height: number; golden: boolean; delay?: number }) {
  const top = 228 - height;
  const stem = golden ? "#c9952c" : "#4d9a3e";
  const head = golden ? "url(#grainGold)" : "url(#grainGreen)";
  const awn = golden ? "#b8842a" : "#6fb35c";
  const spikelets = Array.from({ length: 7 }, (_, i) => i);
  return (
    <g className="sway" style={{ animationDelay: `${delay}s` }}>
      <path d={`M ${x} 228 C ${x + 2} ${228 - height * 0.4}, ${x - 2} ${228 - height * 0.7}, ${x} ${top + 36}`} stroke={stem} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d={`M ${x} ${228 - height * 0.45} C ${x - 18} ${228 - height * 0.52}, ${x - 24} ${228 - height * 0.66}, ${x - 20} ${228 - height * 0.76}`} stroke={stem} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d={`M ${x} ${228 - height * 0.3} C ${x + 16} ${228 - height * 0.36}, ${x + 22} ${228 - height * 0.5}, ${x + 18} ${228 - height * 0.6}`} stroke={stem} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {spikelets.map((i) => {
        const y = top + 36 - i * 5.2;
        const side = i % 2 === 0 ? -1 : 1;
        return (
          <g key={i}>
            <ellipse cx={x + side * 5} cy={y} rx="6" ry="3.6" fill={head} transform={`rotate(${side * -28} ${x + side * 5} ${y})`} />
            <path d={`M ${x + side * 8} ${y - 2} L ${x + side * 16} ${y - 14}`} stroke={awn} strokeWidth="0.9" opacity="0.85" />
          </g>
        );
      })}
      <ellipse cx={x} cy={top} rx="5" ry="3.4" fill={head} />
    </g>
  );
}

function Sparkles() {
  const pts = [
    [120, 120, 0], [250, 150, 0.6], [90, 170, 1.2], [300, 190, 0.3], [170, 95, 0.9], [215, 205, 1.5],
  ] as const;
  return (
    <g>
      {pts.map(([x, y, d], i) => (
        <g key={i} className="twinkle" style={{ animationDelay: `${d}s` }}>
          <path d={`M ${x} ${y - 6} L ${x + 1.8} ${y - 1.8} L ${x + 6} ${y} L ${x + 1.8} ${y + 1.8} L ${x} ${y + 6} L ${x - 1.8} ${y + 1.8} L ${x - 6} ${y} L ${x - 1.8} ${y - 1.8} Z`} fill="#fff6d6" />
        </g>
      ))}
    </g>
  );
}

export default function WheatScene({ stage, className }: { stage: Stage; className?: string }) {
  const p = PALETTE[stage];
  const sun = SUN_POS[stage];
  const buried = stage >= 2;

  return (
    <svg
      viewBox="0 0 360 300"
      className={className}
      role="img"
      aria-label={`밀알 ${stage}단계`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.skyTop} />
          <stop offset="1" stopColor={p.skyBottom} />
        </linearGradient>
        <radialGradient id="sunGlow">
          <stop offset="0" stopColor={p.sunGlow} stopOpacity="0.95" />
          <stop offset="1" stopColor={p.sunGlow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="seedGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3c875" />
          <stop offset="1" stopColor="#b87a24" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8fd46f" />
          <stop offset="1" stopColor="#3f9a3b" />
        </linearGradient>
        <linearGradient id="grainGreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b7e39a" />
          <stop offset="1" stopColor="#5ea04e" />
        </linearGradient>
        <linearGradient id="grainGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe39a" />
          <stop offset="1" stopColor="#d39a2e" />
        </linearGradient>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.ground} />
          <stop offset="1" stopColor="#4e2d17" />
        </linearGradient>
        <clipPath id="frame">
          <rect x="0" y="0" width="360" height="300" rx="24" />
        </clipPath>
      </defs>

      <g clipPath="url(#frame)">
        {/* 하늘 */}
        <rect x="0" y="0" width="360" height="300" fill="url(#sky)" />

        {/* 해 */}
        <circle cx={sun.cx} cy={sun.cy} r={sun.r * 2.6} fill="url(#sunGlow)" />
        {stage === 1 &&
          Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x1 = sun.cx + Math.cos(a) * (sun.r + 8);
            const y1 = sun.cy + Math.sin(a) * (sun.r + 8);
            const x2 = sun.cx + Math.cos(a) * (sun.r + 26);
            const y2 = sun.cy + Math.sin(a) * (sun.r + 26);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={p.sun} strokeWidth="3" strokeLinecap="round" opacity="0.7" />;
          })}
        <circle cx={sun.cx} cy={sun.cy} r={sun.r} fill={p.sun} />

        {/* 먼 언덕 */}
        <path d="M 0 190 C 60 160, 120 170, 180 180 C 240 190, 300 160, 360 178 L 360 300 L 0 300 Z" fill={p.hillFar} opacity="0.9" />
        {/* 가까운 언덕 */}
        <path d="M 0 214 C 70 196, 140 206, 200 212 C 260 218, 310 200, 360 210 L 360 300 L 0 300 Z" fill={p.hillNear} />

        {/* 땅 — 심긴 이후엔 흙 단면을 보여준다 */}
        {buried ? (
          <>
            <rect x="0" y="228" width="360" height="72" fill="url(#soil)" />
            <path d="M 0 228 C 40 224, 80 232, 120 228 C 160 224, 200 232, 240 228 C 280 224, 320 232, 360 228 L 360 236 L 0 236 Z" fill={p.ground} />
            {[30, 95, 150, 210, 270, 330].map((x, i) => (
              <ellipse key={i} cx={x} cy={250 + (i % 3) * 12} rx="5" ry="2.6" fill="#3e2211" opacity="0.45" />
            ))}
          </>
        ) : (
          <>
            <rect x="0" y="228" width="360" height="72" fill={p.ground} />
            {[[20, 242, 70], [110, 256, 50], [200, 246, 90], [290, 260, 60]].map(([x, y, w], i) => (
              <path key={i} d={`M ${x} ${y} l ${w * 0.35} 4 l ${w * 0.3} -3 l ${w * 0.35} 5`} stroke="#9a6a3c" strokeWidth="1.4" fill="none" opacity="0.8" />
            ))}
          </>
        )}

        {/* 1단계: 땅 위의 씨앗 */}
        {stage === 1 && (
          <>
            <ellipse cx="180" cy="232" rx="18" ry="4" fill="#000" opacity="0.18" />
            <Seed x={180} y={222} />
          </>
        )}

        {/* 2단계: 흙 속에 묻힌 씨앗 */}
        {stage === 2 && (
          <>
            <ellipse cx="180" cy="226" rx="22" ry="5" fill="#5e3a1f" opacity="0.9" />
            <Seed x={180} y={252} rotate={-10} scale={0.95} />
            <circle cx="180" cy="252" r="22" fill="none" stroke="#c7a06f" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
          </>
        )}

        {/* 3단계: 새싹 */}
        {stage === 3 && (
          <>
            <Seed x={180} y={254} rotate={-10} scale={0.8} />
            <path d="M 180 246 C 182 240, 180 234, 180 228" stroke="#e7d9b8" strokeWidth="2" fill="none" opacity="0.8" />
            <Sprout />
          </>
        )}

        {/* 4단계: 자란 밀 (초록) */}
        {stage === 4 && (
          <>
            <Stalk x={150} height={92} golden={false} delay={0.4} />
            <Stalk x={180} height={118} golden={false} />
            <Stalk x={210} height={98} golden={false} delay={0.9} />
          </>
        )}

        {/* 5단계: 결실 (황금) */}
        {stage === 5 && (
          <>
            <Stalk x={120} height={96} golden delay={0.6} />
            <Stalk x={150} height={116} golden delay={0.2} />
            <Stalk x={180} height={134} golden />
            <Stalk x={210} height={118} golden delay={0.8} />
            <Stalk x={240} height={98} golden delay={0.4} />
            <Sparkles />
          </>
        )}
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: 개발용 미리보기 페이지**

`app/dev/scene/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import WheatScene from "@/components/WheatScene";
import { STAGE_INFO } from "@/lib/rules";
import type { Stage } from "@/lib/types";

export default function ScenePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const stages: Stage[] = [1, 2, 3, 4, 5];
  return (
    <main className="py-8">
      <h1 className="mb-4 text-xl font-bold">밀알 5단계 미리보기 (개발용)</h1>
      <div className="flex flex-col gap-6">
        {stages.map((s) => (
          <section key={s} className="card overflow-hidden">
            <WheatScene stage={s} />
            <div className="p-4">
              <p className="font-bold">
                {s}단계 · {STAGE_INFO[s].title}
              </p>
              <p className="text-sm text-[var(--muted)]">{STAGE_INFO[s].caption}</p>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 확인**

```bash
npx tsc --noEmit && npm run lint
```
Expected: 오류 없음.

`npm run dev` 후 브라우저로 `http://localhost:3000/dev/scene` 열어 5장면을 확인한다. 점검 기준:
- 1단계: 땅 위에 씨앗, 햇살 12줄, 마른 땅 금
- 2단계: 흙 단면에 씨앗이 묻혀 있고 땅 위는 비어 있음
- 3단계: 두 잎 새싹이 좌우로 살랑임
- 4단계: 초록 밀 3줄기, 이삭 초록
- 5단계: 황금 밀 5줄기, 노을 하늘, 반짝임
모바일 폭(375px)에서도 가로를 꽉 채우고 잘리지 않는다.

- [ ] **Step 4: 커밋**

```bash
git add components/WheatScene.tsx app/dev
git commit -m "feat: 밀알 5단계 SVG 장면과 개발용 미리보기

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 10: 밭 화면

**Files:**
- Create: `components/ProgressCard.tsx`, `components/CheckButtons.tsx`, `components/RequestButtons.tsx`, `components/MemberList.tsx`
- Create: `app/field/page.tsx`

**Interfaces:**
- Consumes: `FieldState`, `WheatScene`, `STAGE_INFO`, `nextThreshold`, `MAX_POINTS`, `REQUEST_POINTS`, `api`, `getSavedName`, `clearName`
- Produces: `/field` 화면. 30초마다 상태 재조회.

- [ ] **Step 1: 진행 카드**

`components/ProgressCard.tsx`:
```tsx
import { MAX_POINTS, STAGE_INFO, nextThreshold } from "@/lib/rules";
import type { Stage } from "@/lib/types";

export default function ProgressCard({ total, stage }: { total: number; stage: Stage }) {
  const next = nextThreshold(total);
  const pct = Math.min(100, Math.round((total / MAX_POINTS) * 100));
  return (
    <section className="card p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[var(--muted)]">{stage}단계</p>
          <h2 className="text-xl font-extrabold">{STAGE_INFO[stage].title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{STAGE_INFO[stage].caption}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black tabular-nums">{total}</p>
          <p className="text-xs text-[var(--muted)]">/ {MAX_POINTS}점</p>
        </div>
      </div>
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[#efe3cf]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8fd46f] via-[#e0a53a] to-[#b97a1e] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {next === null ? "밀알이 결실을 맺었어요 🎉" : `다음 단계까지 ${next - total}점`}
      </p>
    </section>
  );
}
```

- [ ] **Step 2: 체크 버튼**

`components/CheckButtons.tsx`:
```tsx
import type { CheckKind } from "@/lib/types";

type Props = {
  bible: boolean;
  resolve: boolean;
  busy: CheckKind | null;
  onCheck: (kind: CheckKind) => void;
};

const ITEMS: { kind: CheckKind; icon: string; label: string }[] = [
  { kind: "bible", icon: "📖", label: "성경 읽었어요" },
  { kind: "resolve", icon: "✅", label: "다짐 지켰어요" },
];

export default function CheckButtons({ bible, resolve, busy, onCheck }: Props) {
  const done = { bible, resolve };
  return (
    <section className="card p-5">
      <h3 className="text-sm font-bold text-[var(--muted)]">오늘 내 체크</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {ITEMS.map(({ kind, icon, label }) => {
          const isDone = done[kind];
          return (
            <button
              key={kind}
              type="button"
              disabled={isDone || busy !== null}
              onClick={() => onCheck(kind)}
              className={`btn flex-col py-4 text-[15px] ${isDone ? "btn-done" : "btn-primary"} ${busy === kind ? "pop" : ""}`}
            >
              <span className="text-2xl">{icon}</span>
              <span>{label}</span>
              <span className="text-xs font-semibold opacity-80">{isDone ? "내일 다시" : "+1"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: 요청 버튼**

`components/RequestButtons.tsx`:
```tsx
import { REQUEST_POINTS } from "@/lib/rules";
import type { RequestKind } from "@/lib/types";

type Props = {
  pendingCount: number;
  busy: RequestKind | null;
  onRequest: (kind: RequestKind) => void;
};

const ITEMS: { kind: RequestKind; icon: string; label: string }[] = [
  { kind: "prayer", icon: "🙏", label: "기도부탁" },
  { kind: "invite_remote", icon: "💬", label: "비대면 권유" },
  { kind: "invite_face", icon: "🤝", label: "대면 권유" },
];

export default function RequestButtons({ pendingCount, busy, onRequest }: Props) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--muted)]">추가 요청</h3>
        {pendingCount > 0 && (
          <span className="rounded-full bg-[#fff3d6] px-2.5 py-0.5 text-xs font-semibold text-[var(--wheat-deep)]">
            대기 중 {pendingCount}건
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ITEMS.map(({ kind, icon, label }) => (
          <button
            key={kind}
            type="button"
            disabled={busy !== null}
            onClick={() => onRequest(kind)}
            className={`btn btn-ghost flex-col px-2 py-3 text-[13px] ${busy === kind ? "pop" : ""}`}
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
            <span className="text-xs font-semibold text-[var(--wheat-deep)]">+{REQUEST_POINTS[kind]}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">관리자 확인 후 점수에 반영됩니다.</p>
    </section>
  );
}
```

- [ ] **Step 4: 구성원 목록**

`components/MemberList.tsx`:
```tsx
import type { MemberSummary } from "@/lib/types";

export default function MemberList({ members, me }: { members: MemberSummary[]; me: string }) {
  const sorted = [...members].sort((a, b) => {
    const ad = Number(a.bible) + Number(a.resolve);
    const bd = Number(b.bible) + Number(b.resolve);
    if (bd !== ad) return bd - ad; // 오늘 체크한 사람 먼저
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name, "ko");
  });
  return (
    <section className="card p-5">
      <h3 className="text-sm font-bold text-[var(--muted)]">함께 자라는 사람들</h3>
      <ul className="mt-3 divide-y divide-[rgba(124,74,45,0.08)]">
        {sorted.map((m) => {
          const active = m.bible || m.resolve;
          return (
            <li key={m.name} className={`flex items-center justify-between py-2 ${active ? "" : "opacity-60"}`}>
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${active ? "bg-[var(--leaf)]" : "bg-[#d8cbb8]"}`} />
                <span className={`text-sm ${m.name === me ? "font-bold" : ""}`}>
                  {m.name}
                  {m.name === me && <span className="ml-1 text-xs text-[var(--muted)]">(나)</span>}
                </span>
              </span>
              <span className="flex items-center gap-2 text-sm tabular-nums">
                <span className="w-8 text-center">{m.bible ? "📖" : ""}</span>
                <span className="w-8 text-center">{m.resolve ? "✅" : ""}</span>
                <span className="w-10 text-right font-semibold">{m.points}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: 밭 페이지**

`app/field/page.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WheatScene from "@/components/WheatScene";
import ProgressCard from "@/components/ProgressCard";
import CheckButtons from "@/components/CheckButtons";
import RequestButtons from "@/components/RequestButtons";
import MemberList from "@/components/MemberList";
import { api, clearName, getSavedName } from "@/lib/client";
import type { CheckKind, FieldState, RequestKind } from "@/lib/types";

const REFRESH_MS = 30_000;

export default function FieldPage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [state, setState] = useState<FieldState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyCheck, setBusyCheck] = useState<CheckKind | null>(null);
  const [busyRequest, setBusyRequest] = useState<RequestKind | null>(null);
  const [floating, setFloating] = useState<{ id: number; text: string } | null>(null);
  const prevStage = useRef<number | null>(null);
  const [stageKey, setStageKey] = useState(0);

  const load = useCallback(async (who: string) => {
    const { status, data } = await api<FieldState>(`/api/state?name=${encodeURIComponent(who)}`);
    if (status === 404) {
      clearName();
      router.replace("/");
      return;
    }
    setState(data);
  }, [router]);

  useEffect(() => {
    const saved = getSavedName();
    if (!saved) {
      router.replace("/");
      return;
    }
    setName(saved);
    load(saved);
    const timer = setInterval(() => load(saved), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, router]);

  // 단계가 오르면 장면을 다시 그려 fade-up 애니메이션을 준다
  useEffect(() => {
    if (!state) return;
    if (prevStage.current !== null && state.stage > prevStage.current) {
      setStageKey((k) => k + 1);
      showToast(`${state.stage}단계로 자랐어요! 🌱`);
    }
    prevStage.current = state.stage;
  }, [state]);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }

  function showFloating(text: string) {
    setFloating({ id: Date.now(), text });
    setTimeout(() => setFloating(null), 1100);
  }

  async function onCheck(kind: CheckKind) {
    if (!name) return;
    setBusyCheck(kind);
    const { status, data } = await api<FieldState | { error: string }>("/api/check", {
      method: "POST",
      body: { name, kind },
    });
    setBusyCheck(null);
    if (status === 200) {
      setState(data as FieldState);
      showFloating("+1");
    } else if (status === 409) {
      showToast("오늘은 이미 체크했어요. 내일 다시!");
      load(name);
    } else {
      showToast("잠시 후 다시 시도해주세요");
    }
  }

  async function onRequest(kind: RequestKind) {
    if (!name) return;
    setBusyRequest(kind);
    const { status } = await api("/api/request", { method: "POST", body: { name, kind } });
    setBusyRequest(null);
    if (status === 200) {
      showToast("요청했어요. 관리자 확인 후 반영됩니다 🙌");
      load(name);
    } else {
      showToast("잠시 후 다시 시도해주세요");
    }
  }

  function logout() {
    clearName();
    router.replace("/");
  }

  if (!state || !name) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-[var(--muted)]">
        밭으로 가는 중…
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 py-5">
      <header className="flex items-center justify-between px-1">
        <div>
          <p className="text-xs text-[var(--muted)]">{state.today} · 한국시간</p>
          <h1 className="text-lg font-extrabold">
            {name}님의 밭 {state.me.isAdmin && <span className="ml-1 text-xs font-semibold text-[var(--wheat-deep)]">관리자</span>}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {state.me.isAdmin && (
            <Link href="/admin" className="rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-white">
              관리
            </Link>
          )}
          <button type="button" onClick={logout} className="text-[var(--muted)] underline">
            나가기
          </button>
        </div>
      </header>

      <section className="card relative overflow-hidden p-0">
        <div key={stageKey} className="fade-up">
          <WheatScene stage={state.stage} />
        </div>
        {floating && (
          <span
            key={floating.id}
            className="float-up pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 text-3xl font-black text-[var(--wheat-deep)] drop-shadow"
          >
            {floating.text}
          </span>
        )}
      </section>

      <ProgressCard total={state.total} stage={state.stage} />

      <CheckButtons bible={state.me.bible} resolve={state.me.resolve} busy={busyCheck} onCheck={onCheck} />

      <RequestButtons pendingCount={state.me.pendingCount} busy={busyRequest} onRequest={onRequest} />

      <MemberList members={state.members} me={name} />

      <footer className="px-1 pt-2 text-center text-xs text-[var(--muted)]">
        오늘 {state.todayCount}명 참여 · 누적 {state.total}점
      </footer>

      {toast && (
        <div className="fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 6: 확인**

```bash
npx tsc --noEmit && npm run lint
```
Expected: 오류 없음.

`rm -rf data && npm run dev` 후 브라우저:
1. `http://localhost:3000` → "이주원" 입력 → `/field`로 이동, 1단계 장면·0점
2. 📖 클릭 → "+1"이 떠오르고 버튼이 "내일 다시"로, 총점 1, 목록에서 이주원이 위로 올라오고 📖 표시
3. ✅ 클릭 → 총점 2
4. 새로고침 → 상태 유지
5. 🙏 클릭 → 토스트, "대기 중 1건"
6. "나가기" → 입장 화면으로

- [ ] **Step 7: 커밋**

```bash
git add components app/field
git commit -m "feat: 밭 화면(장면·진행·체크·요청·구성원 목록)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 11: 관리자 화면

**Files:**
- Create: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `/api/admin/requests`, `/api/admin/decide`, `/api/state`, `/api/dev/set-total`, `KIND_LABEL`, `REQUEST_POINTS`
- Produces: `/admin` 화면. 비관리자는 `/field`로 이동.

- [ ] **Step 1: 관리자 페이지 작성**

`app/admin/page.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getSavedName } from "@/lib/client";
import { KIND_LABEL, REQUEST_POINTS } from "@/lib/rules";
import type { FieldState, PendingRequest } from "@/lib/types";

const isDev = process.env.NODE_ENV !== "production";

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AdminPage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);
  const [state, setState] = useState<FieldState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async (who: string) => {
    const [r, s] = await Promise.all([
      api<PendingRequest[]>(`/api/admin/requests?name=${encodeURIComponent(who)}`),
      api<FieldState>(`/api/state?name=${encodeURIComponent(who)}`),
    ]);
    if (r.status === 403 || s.status !== 200 || !s.data.me.isAdmin) {
      router.replace("/field");
      return;
    }
    setRequests(r.data);
    setState(s.data);
  }, [router]);

  useEffect(() => {
    const saved = getSavedName();
    if (!saved) {
      router.replace("/");
      return;
    }
    setName(saved);
    load(saved);
  }, [load, router]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 1800);
  }

  async function decideOne(id: string, approve: boolean) {
    if (!name) return;
    setBusyId(id);
    const { status, data } = await api<{ ok: boolean; total?: number }>("/api/admin/decide", {
      method: "POST",
      body: { name, id, approve },
    });
    setBusyId(null);
    if (status === 200) {
      flash(approve ? `승인했어요 · 총점 ${data.total}` : "거절했어요");
    } else {
      flash("처리하지 못했어요. 새로고침 후 다시 시도해주세요");
    }
    load(name);
  }

  async function setTotal(total: number) {
    if (!name) return;
    const { status } = await api("/api/dev/set-total", { method: "POST", body: { name, total } });
    flash(status === 200 ? `총점을 ${total}으로 맞췄어요` : "조정 실패");
    load(name);
  }

  if (!state || !requests || !name) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-[var(--muted)]">
        불러오는 중…
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 py-5">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-lg font-extrabold">관리</h1>
        <Link href="/field" className="text-xs text-[var(--muted)] underline">
          밭으로
        </Link>
      </header>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--muted)]">대기 중 요청</h2>
          <span className="text-xs text-[var(--muted)]">{requests.length}건</span>
        </div>
        {requests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">처리할 요청이 없어요.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold">
                    {r.name} <span className="font-normal text-[var(--muted)]">· {KIND_LABEL[r.kind]}</span>
                    <span className="ml-1 text-xs font-bold text-[var(--wheat-deep)]">+{REQUEST_POINTS[r.kind]}</span>
                  </p>
                  <p className="text-xs text-[var(--muted)]">{fmtTime(r.requestedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => decideOne(r.id, true)}
                    className="btn btn-primary px-3 py-2 text-sm"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => decideOne(r.id, false)}
                    className="btn btn-ghost px-3 py-2 text-sm"
                  >
                    거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card grid grid-cols-3 gap-3 p-5 text-center">
        <div>
          <p className="text-2xl font-black tabular-nums">{state.total}</p>
          <p className="text-xs text-[var(--muted)]">총점</p>
        </div>
        <div>
          <p className="text-2xl font-black tabular-nums">{state.stage}</p>
          <p className="text-xs text-[var(--muted)]">단계</p>
        </div>
        <div>
          <p className="text-2xl font-black tabular-nums">{state.todayCount}</p>
          <p className="text-xs text-[var(--muted)]">오늘 참여</p>
        </div>
      </section>

      {isDev && (
        <section className="card border-dashed p-5">
          <h2 className="text-sm font-bold text-[var(--muted)]">테스트용 점수 조정 (개발 모드에서만 보임)</h2>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[0, 200, 400, 700, 1000].map((t) => (
              <button key={t} type="button" onClick={() => setTotal(t)} className="btn btn-ghost px-2 py-2 text-sm">
                {t}
              </button>
            ))}
          </div>
        </section>
      )}

      {msg && (
        <div className="fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {msg}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 확인**

```bash
npx tsc --noEmit && npm run lint
```
Expected: 오류 없음.

브라우저:
1. "이주원"으로 입장 → 🙏, 🤝 요청 2건 올리기 → "나가기"
2. "김은혜"(⭐)로 입장 → 상단 "관리" 링크 → `/admin`
3. 대기 2건이 이름·종류·점수·시각과 함께 보임. 첫 건 승인 → "승인했어요 · 총점 3", 둘째 건 거절 → 목록 비움
4. "밭으로" → 총점 3, 이주원 기여 3점
5. 점수 조정 200 → 밭에서 2단계, 400 → 3단계, 700 → 4단계, 1000 → 5단계 장면 확인. 0으로 되돌림
6. "이주원"으로 다시 입장해 `http://localhost:3000/admin` 직접 접속 → `/field`로 튕김

- [ ] **Step 3: 커밋**

```bash
git add app/admin
git commit -m "feat: 관리자 화면(요청 승인/거절, 현황, 개발용 점수 조정)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
```

---

### Task 12: README, 프로덕션 빌드 확인, 마무리

**Files:**
- Modify: `README.md` (create-next-app 기본 내용을 교체)

**Interfaces:**
- Produces: 실행·테스트·명단 교체·배포 준비 안내

- [ ] **Step 1: README 작성**

`README.md` 전체 교체:
```markdown
# 밀알 (Milal)

한 알의 밀이 땅에 떨어져 — 30명이 함께 키우는 공동체 밀알.
매일 성경읽기·다짐 체크와 기도부탁·권유 활동으로 포인트를 모아 하나의 밀알을 결실까지 키웁니다.

설계: `docs/superpowers/specs/2026-08-21-milal-design.md`

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 규칙·저장소·서비스 단위 테스트
```

로컬 데이터는 `data/` 폴더의 JSON 파일에 저장됩니다 (git 제외). 초기화하려면 폴더를 지우세요.

## 테스트 명단

처음 실행하면 `lib/members.ts`의 30명이 `data/members.json`에 저장됩니다. 첫 번째 `김은혜`가 관리자입니다.
개발 모드의 입장 화면에서 "테스트 명단 보기"로 이름을 고를 수 있습니다.

실제 명단으로 바꾸려면 `data/members.json`을 직접 편집하세요:

```json
[
  { "name": "홍길동", "isAdmin": true },
  { "name": "김철수", "isAdmin": false }
]
```

## 수동 테스트 순서

1. 명단에 없는 이름 → "명단에 없는 이름입니다"
2. 일반 구성원으로 입장 → 1단계 씨앗, 0점
3. 📖 / ✅ 클릭 → +1씩, 버튼은 "내일 다시"로. 새로고침해도 유지
4. 🙏 / 💬 / 🤝 요청 → "대기 중 N건"
5. 관리자(⭐)로 입장 → "관리" → 승인/거절 → 총점 반영
6. 관리 화면의 점수 조정 0 / 200 / 400 / 700 / 1000 → 5단계 장면 확인 (`/dev/scene`에서 한 번에 보기)
7. 같은 Wi-Fi 휴대폰에서 `http://<맥 IP>:3000` 접속 (맥 IP: `ipconfig getifaddr en0`)

## 규칙 요약

- 날짜는 한국시간(Asia/Seoul) 기준. 자정에 새 날
- 성경 +1, 다짐 +1 (각각 하루 1회) · 기도부탁 +3 · 비대면 권유 +5 · 대면 권유 +7 (관리자 승인 시)
- 단계: 0–199 / 200–399 / 400–699 / 700–999 / 1000+
- 총점은 `data/ledger.json`의 합

## 배포 (나중에)

Vercel에 이 레포를 연결하고 Vercel Blob 스토어를 추가하면 `BLOB_READ_WRITE_TOKEN`이 자동 주입되어 저장소가 Blob으로 전환됩니다.
자세한 절차는 구현 완료 후 별도 안내.
```

- [ ] **Step 2: 프로덕션 빌드와 개발 전용 기능 차단 확인**

```bash
npm run build
```
Expected: 빌드 성공.

```bash
npm run start > /tmp/milal-prod.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "scene: %{http_code}\n" http://localhost:3000/dev/scene
curl -s -o /dev/null -w "set-total: %{http_code}\n" -X POST http://localhost:3000/api/dev/set-total -H 'content-type: application/json' -d '{"name":"김은혜","total":500}'
curl -s -o /dev/null -w "field: %{http_code}\n" http://localhost:3000/field
kill %1
```
Expected: `scene: 404`, `set-total: 404`, `field: 200`.

- [ ] **Step 3: 전체 테스트 최종 확인**

```bash
npm test && npx tsc --noEmit && npm run lint
```
Expected: 전부 통과.

- [ ] **Step 4: 커밋과 푸시**

```bash
git add README.md
git commit -m "docs: 실행·테스트·명단 교체 안내

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QJGooondLoH3rW3a77mKGB"
git push origin main
```

---

## 자체 점검 결과

- **스펙 커버리지**: §2 요구사항 전부 — 이름 인증(T4/T8), 30명 시드(T4), 공동 총점(T5), 매일 2항목 KST 1회(T5), 요청 3종·제한 없음(T6), 관리자 승인/거절(T6/T11), 단계 구간(T2), 1000점 이후 유지(T2 `stageOf`), 공통 화면(T10), SVG 내장(T9). §6 API 전부(T7). §7 화면 3개 + 미리보기(T8–T11). §9 자동 테스트 항목 전부(T2–T6), 수동 순서(T12 README).
- **타입 일관성**: `FieldState.me.pendingCount`, `CheckKind`/`RequestKind`, `REQUEST_POINTS`, `KIND_LABEL`, `STAGE_INFO`, `nextThreshold` 이름이 전 Task에서 동일.
- **플레이스홀더 없음**: 모든 코드 단계에 실제 코드 포함. Blob 저장소는 배포 시 검증한다고 명시(스펙 §10 범위 밖).
