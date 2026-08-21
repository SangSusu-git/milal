import { describe, it, expect } from "vitest";
import {
  todayKST,
  stageOf,
  nextThreshold,
  sumPoints,
  REQUEST_POINTS,
  isCheckKind,
  isRequestKind,
} from "@/lib/rules";

describe("todayKST", () => {
  it("UTC 14:59는 아직 KST 같은 날", () => {
    expect(todayKST(new Date("2026-08-21T14:59:00Z"))).toBe("2026-08-21");
  });
  it("UTC 15:00은 KST 자정 → 다음 날", () => {
    expect(todayKST(new Date("2026-08-21T15:00:00Z"))).toBe("2026-08-22");
  });
  it("UTC 15:30 → KST 00:30 다음 날", () => {
    expect(todayKST(new Date("2026-08-21T15:30:00Z"))).toBe("2026-08-22");
  });
  it("연말 경계", () => {
    expect(todayKST(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});

describe("stageOf", () => {
  it.each([
    [0, 1],
    [199, 1],
    [200, 2],
    [399, 2],
    [400, 3],
    [699, 3],
    [700, 4],
    [999, 4],
    [1000, 5],
    [1500, 5],
  ])("total %i → stage %i", (total, stage) => {
    expect(stageOf(total)).toBe(stage);
  });
});

describe("nextThreshold", () => {
  it("다음 단계 기준점을 돌려준다", () => {
    expect(nextThreshold(0)).toBe(200);
    expect(nextThreshold(199)).toBe(200);
    expect(nextThreshold(200)).toBe(400);
    expect(nextThreshold(999)).toBe(1000);
  });
  it("결실 후에는 null", () => {
    expect(nextThreshold(1000)).toBeNull();
    expect(nextThreshold(1200)).toBeNull();
  });
});

describe("points", () => {
  it("요청 종류별 점수", () => {
    expect(REQUEST_POINTS.prayer).toBe(3);
    expect(REQUEST_POINTS.invite_remote).toBe(5);
    expect(REQUEST_POINTS.invite_face).toBe(7);
  });
  it("ledger 합산", () => {
    expect(
      sumPoints([
        { at: "", name: "a", kind: "bible", points: 1 },
        { at: "", name: "b", kind: "prayer", points: 3 },
        { at: "", name: "__dev__", kind: "adjust", points: -2 },
      ])
    ).toBe(2);
    expect(sumPoints([])).toBe(0);
  });
});

describe("kind guards", () => {
  it("체크 종류", () => {
    expect(isCheckKind("bible")).toBe(true);
    expect(isCheckKind("resolve")).toBe(true);
    expect(isCheckKind("prayer")).toBe(false);
    expect(isCheckKind(undefined)).toBe(false);
  });
  it("요청 종류", () => {
    expect(isRequestKind("prayer")).toBe(true);
    expect(isRequestKind("invite_remote")).toBe(true);
    expect(isRequestKind("invite_face")).toBe(true);
    expect(isRequestKind("bible")).toBe(false);
    expect(isRequestKind(3)).toBe(false);
  });
});
