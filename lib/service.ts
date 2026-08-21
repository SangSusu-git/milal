import type { Store } from "./store/types";
import { ensureMembers, findMember } from "./members";

export type LoginResult =
  | { ok: true; name: string; isAdmin: boolean }
  | { ok: false };

export async function login(store: Store, rawName: string): Promise<LoginResult> {
  const members = await ensureMembers(store);
  const member = findMember(members, rawName);
  if (!member) return { ok: false };
  return { ok: true, name: member.name, isAdmin: member.isAdmin };
}
