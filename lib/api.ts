import { NextResponse } from "next/server";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** 본문이 JSON이 아니면 빈 객체 */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
