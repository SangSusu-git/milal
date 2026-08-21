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
