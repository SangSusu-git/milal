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
    if (result.reason === "guest") return error("게스트는 점수 반영이 안됩니다", 403);
    return error("already", 409);
  }
  const state = await getState(store, String(name));
  return json(state);
}
