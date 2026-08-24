import { getStore } from "@/lib/store";
import { restoreBackup } from "@/lib/service";
import { error, json, readJson } from "@/lib/api";

export async function POST(req: Request) {
  const { name, backup } = await readJson(req);
  const result = await restoreBackup(getStore(), String(name ?? ""), backup);
  if (!result.ok) {
    if (result.reason === "forbidden") return error("관리자만 복원할 수 있습니다", 403);
    return error("올바르지 않은 백업 파일입니다", 400);
  }
  return json(result);
}
