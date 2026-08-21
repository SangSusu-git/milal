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
