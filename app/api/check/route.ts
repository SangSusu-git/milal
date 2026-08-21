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
