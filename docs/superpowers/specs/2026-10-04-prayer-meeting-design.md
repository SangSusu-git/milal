# 기도모임 체크 항목 — 구현 설계 (미확정, 사전 설계)

작성: 2026-10-04 · 상태: **검토용 초안 — 아직 구현하지 않음**

## 목표

10월 5일부터 시작하는 기도모임 참석을 성경읽기·다짐과 같은 "오늘 내 체크" 항목으로 추가한다.
참석을 체크하면 +1점. 모니터링 화면에도 항목이 생기고 집계에 포함된다.

## 확정된 것 / 가정한 것

| 항목 | 내용 | 상태 |
|---|---|---|
| 점수 | 체크 1회 +1 | 사용자 언급 ("일단 1점") |
| 위치 | 밭 화면 "오늘 내 체크" 카드의 세 번째 버튼 | 사용자 언급 |
| 시작일 | 2026-10-05 (KST). 그 전에는 버튼이 보이지 않음 | 사용자 언급 |
| 체크 방식 | 본인이 직접 체크, 하루 1회 (성경·다짐과 동일) | **가정** |
| 요일 제한 | 없음 — 시작일 이후 매일 체크 가능 | **가정 (결정 필요)** |
| 이벤트 배율 | `CHECK_POINT_EVENTS`(x3 등)를 기도모임에도 적용할지 | **결정 필요** — 기본안: 적용 안 함 |
| "오늘 참여" 집계 | 기도모임만 체크한 사람도 오늘 참여자로 셈 | **가정** |
| 아이콘 | 🕯️ (🙏는 기도부탁이 이미 사용 중이라 구분) | **가정** |

## 데이터 모델

장부(ledger)에 기존과 같은 형식으로 쌓는다. 새 종류 하나만 추가된다.

```ts
// lib/types.ts
export type CheckKind = "bible" | "resolve" | "meeting";

export interface DayCheck {
  bible: boolean;
  resolve: boolean;
  meeting?: boolean; // 기존에 저장된 날짜에는 없으므로 optional — 없으면 false로 본다
}
```

- 장부 항목: `{ at, name, kind: "meeting", points: 1 }`
- 기존 데이터는 **변환이 필요 없다.** 옛 `checks`에는 `meeting` 키가 없고 그대로 false로 읽힌다.
- 백업/복원 파일 형식(version 1)도 그대로다. 검증기는 checks 내부 키를 보지 않는다.

## 규칙 (lib/rules.ts)

```ts
export const KIND_LABEL = { ..., meeting: "기도모임" };

/** 기도모임 체크가 열리는 첫 날 (KST). 이 날짜 전에는 버튼도 없고 서버도 거부한다. */
export const MEETING_START_DATE = "2026-10-05";

export function isMeetingOpen(date: string): boolean {
  return date >= MEETING_START_DATE; // YYYY-MM-DD는 문자열 비교로 순서가 맞다
}
```

`isCheckKind`에 `"meeting"`을 추가한다. 요일 제한을 넣기로 하면 `isMeetingOpen`에
요일 조건만 더하면 되고 다른 코드는 바뀌지 않는다.

체크 점수: `checkPointsOn(date)`는 지금 날짜만 받는다. 이벤트를 기도모임에 적용하지 않는
기본안이라면 `meeting`은 항상 `CHECK_POINTS`(1)를 쓴다 — `checkPointsOn(date, kind)`로
시그니처를 넓히고 `kind === "meeting"`이면 이벤트 표를 건너뛴다.

## 서비스 (lib/service.ts)

- `check()`: `kind === "meeting"`이고 `!isMeetingOpen(today)`면 `{ ok: false, reason: "not_open" }`.
  API는 400 "아직 시작하지 않았어요"로 응답. 게스트 거부·하루 1회 규칙은 기존 로직 그대로 탄다.
- `getState()`: `me.meeting`(오늘 체크 여부)과 최상위 `meetingOpen`(버튼을 보여줄지)을 추가.
- `todayParticipants`: `meeting`도 참여로 센다.
- `monitorData()`: `byKind`에 `meeting: 0` 초기값 추가. 나머지 집계는 종류와 무관하게 동작한다.

## 화면

- **CheckButtons**: 항목 배열에 `{ kind: "meeting", icon: "🕯️", label: "기도모임 갔어요" }` 추가.
  `meetingOpen`이 false면 이 버튼을 그리지 않고 지금처럼 2열을 유지한다. true면 3열.
  (대안: 2열 + 아래 넓은 1개 — 미리보기 B안)
- **모니터링**: `KINDS`와 `KIND_EMOJI`에 `meeting` 추가 → 간략히 표와 자세히 표에 🕯️ 열이
  하나 늘어난다. 열 순서: 📖 ✅ 🕯️ 🙏 💬 🤝 합계 (체크 항목끼리 붙임).
- **관리자**: 변경 없음 (승인 기록은 요청·보너스만 다룬다).

## 테스트

- 시작일 전날 `check(meeting)` → `not_open`, 점수 변화 없음
- 시작일 당일 +1, 같은 날 두 번째는 `already`
- 게스트는 `guest`로 거부
- 성경·다짐과 독립 — 셋 다 체크하면 하루 +3
- x3 이벤트 날에도 기도모임은 +1 (기본안 선택 시)
- `monitorData().users[].byKind.meeting`와 날짜별 합계에 반영
- `meeting` 키가 없는 옛 checks가 false로 읽히는지

## 배포 순서

코드에 시작일 조건이 들어 있으므로 **10/5 전에 미리 배포해도 안전하다.** 데이터 작업은 없다.
이미 지난 날짜의 참석을 소급해 넣어야 하면 보너스 때처럼 백업 → 장부 삽입 → 복원으로 한다.

## 결정이 필요한 것

1. 매일 체크 가능하게 둘지, 모임이 있는 요일에만 버튼을 열지
2. 버튼 배치 A안(3열) / B안(2열 + 넓은 1개)
3. 앞으로 x3 같은 이벤트를 할 때 기도모임도 배율에 포함할지
4. 아이콘 🕯️ 과 문구 "기도모임 갔어요"
