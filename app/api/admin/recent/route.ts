import { getStore } from "@/lib/store";
import { listRequests, recentLedger } from "@/lib/service";
import { error, json } from "@/lib/api";

export const dynamic = "force-dynamic";

const RECENT_LIMIT = 20;

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  // listRequests returns null for non-admins — reuse it as the admin gate
  if ((await listRequests(getStore(), name)) === null) {
    return error("관리자만 볼 수 있습니다", 403);
  }
  return json(await recentLedger(getStore(), RECENT_LIMIT));
}
