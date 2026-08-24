import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { exportBackup } from "@/lib/service";
import { error } from "@/lib/api";
import { todayKST } from "@/lib/rules";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const backup = await exportBackup(getStore(), name);
  if (!backup) return error("관리자만 내려받을 수 있습니다", 403);
  return NextResponse.json(backup, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="milal-backup-${todayKST()}.json"`,
    },
  });
}
