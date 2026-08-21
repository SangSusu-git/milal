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
