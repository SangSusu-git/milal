import { getStore } from "@/lib/store";
import { requestHistory } from "@/lib/service";
import { error, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const history = await requestHistory(getStore(), name);
  if (!history) return error("관리자만 볼 수 있습니다", 403);
  return json(history);
}
