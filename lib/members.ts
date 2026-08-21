import type { Member } from "./types";
import type { Store } from "./store/types";

/** 테스트용 30명. 첫 번째가 관리자. 실제 운영 시 data/members.json을 고쳐 교체한다. */
export const SEED_MEMBERS: Member[] = [
  { name: "김은혜", isAdmin: true },
  { name: "이주원", isAdmin: false },
  { name: "박서준", isAdmin: false },
  { name: "최지우", isAdmin: false },
  { name: "정다은", isAdmin: false },
  { name: "강민준", isAdmin: false },
  { name: "조예린", isAdmin: false },
  { name: "윤도현", isAdmin: false },
  { name: "장서연", isAdmin: false },
  { name: "임태양", isAdmin: false },
  { name: "한소희", isAdmin: false },
  { name: "오승현", isAdmin: false },
  { name: "신유진", isAdmin: false },
  { name: "권지훈", isAdmin: false },
  { name: "황예은", isAdmin: false },
  { name: "안재민", isAdmin: false },
  { name: "송하린", isAdmin: false },
  { name: "전우진", isAdmin: false },
  { name: "홍수아", isAdmin: false },
  { name: "고준영", isAdmin: false },
  { name: "문채원", isAdmin: false },
  { name: "양시우", isAdmin: false },
  { name: "배나윤", isAdmin: false },
  { name: "백현우", isAdmin: false },
  { name: "허지안", isAdmin: false },
  { name: "남도윤", isAdmin: false },
  { name: "심예나", isAdmin: false },
  { name: "노건우", isAdmin: false },
  { name: "하윤서", isAdmin: false },
  { name: "구민재", isAdmin: false },
];

export async function ensureMembers(store: Store): Promise<Member[]> {
  const existing = await store.get<Member[]>("members");
  if (existing && existing.length > 0) return existing;
  await store.set("members", SEED_MEMBERS);
  return SEED_MEMBERS;
}

export function findMember(members: Member[], rawName: string): Member | null {
  const name = (rawName ?? "").trim();
  if (!name) return null;
  return members.find((m) => m.name === name) ?? null;
}
