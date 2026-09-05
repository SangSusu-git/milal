import { getStore } from "@/lib/store";
import { monitorData } from "@/lib/service";
import { error, json } from "@/lib/api";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const data = await monitorData(getStore(), name);
  if (!data) return error("권한이 없습니다", 403);
  return json(data);
}
