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
