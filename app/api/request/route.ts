import { getStore } from "@/lib/store";
import { addRequest } from "@/lib/service";
import { error, json, readJson } from "@/lib/api";
import type { RequestKind } from "@/lib/types";

export async function POST(req: Request) {
  const { name, kind, target } = await readJson(req);
  const result = await addRequest(
    getStore(),
    String(name ?? ""),
    kind as RequestKind,
    String(target ?? "")
  );
  if (!result.ok) {
    if (result.reason === "bad_kind") return error("잘못된 요청 종류입니다", 400);
    if (result.reason === "empty_target") return error("이름을 입력해주세요", 400);
    if (result.reason === "target_too_long") return error("이름이 너무 길어요", 400);
    return error("명단에 없는 이름입니다", 404);
  }
  return json(result);
}
