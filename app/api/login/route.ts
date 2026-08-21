import { getStore } from "@/lib/store";
import { login } from "@/lib/service";
import { error, json, readJson } from "@/lib/api";

export async function POST(req: Request) {
  const { name } = await readJson(req);
  const result = await login(getStore(), String(name ?? ""));
  if (!result.ok) return error("명단에 없는 이름입니다", 404);
  return json(result);
}
