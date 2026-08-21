import { getStore } from "@/lib/store";
import { getState } from "@/lib/service";
import { error, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const state = await getState(getStore(), name);
  if (!state) return error("명단에 없는 이름입니다", 404);
  return json(state);
}
