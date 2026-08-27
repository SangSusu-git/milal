# 밀알 (Milal)

한 알의 밀이 땅에 떨어져 — 30명이 함께 키우는 공동체 밀알.
매일 성경읽기·다짐 체크와 기도부탁·권유 활동으로 포인트를 모아 하나의 밀알을 결실까지 키웁니다.

설계: `docs/superpowers/specs/2026-08-21-milal-design.md`

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 규칙·저장소·서비스 단위 테스트
```

로컬 데이터는 `data/` 폴더의 JSON 파일에 저장됩니다 (git 제외). 초기화하려면 폴더를 지우세요.

## 명단

로컬에서는 `data/members.json`이 명단 그 자체이며 자유롭게 편집할 수 있습니다. 처음 실행하면
`lib/members.ts`의 테스트용 30명이 이 파일에 저장됩니다. 첫 번째 `김은혜`가 관리자입니다.
개발 모드의 입장 화면에서 "테스트 명단 보기"로 이름을 고를 수 있습니다.

```json
[
  { "name": "홍길동", "isAdmin": true },
  { "name": "김철수", "isAdmin": false }
]
```

**배포(프로덕션) 환경은 다릅니다.** `data/members.json`은 로컬 파일 저장소 전용이며, 배포 후에는
쓰이지 않습니다. 프로덕션에서는 `lib/members.ts`의 `SEED_MEMBERS`가 저장소(Upstash Redis)에 **딱
한 번**, 즉 `members` 키가 아직 없는 상태로 첫 요청이 들어올 때만 시딩됩니다. 그 이후로는 다시
읽지 않으므로, 배포 후에 `SEED_MEMBERS`를 고쳐도 이미 저장된 명단에는 아무 영향이 없습니다.

실제 30명 명단으로 바꾸는 공식적인 방법은 관리자 화면의 **백업/복원**입니다: `/admin`에서 백업을
내려받아 JSON의 `members`를 실제 이름과 관리자 1명(`isAdmin: true`)으로 고친 뒤 복원하세요. 복원은
`members`·`requests`·`ledger`·`checks`를 통째로 교체합니다.

실제 명단을 `lib/members.ts`에 넣지 않는 이유: 이 레포는 public이라 코드에 넣으면 실명이 공개됩니다.
실명은 저장소(Redis)에만 두고, 복원용 JSON 파일은 레포 밖에 보관하세요.

## 수동 테스트 순서

1. 명단에 없는 이름 → "명단에 없는 이름입니다"
2. 일반 구성원으로 입장 → 1단계 씨앗, 0점
3. 📖 / ✅ 클릭 → +1씩, 버튼은 "내일 다시"로. 새로고침해도 유지
4. 🙏 / 💬 / 🤝 요청 → "대기 중 N건"
5. 관리자(⭐)로 입장 → "관리" → 승인/거절 → 총점 반영 → 최근 반영 기록 20건 확인
6. 관리 화면의 점수 조정 0 / 200 / 400 / 700 / 1000 → 5단계 장면 확인 (`/dev/scene`에서 한 번에 보기)
7. 같은 Wi-Fi 휴대폰에서 `http://<맥 IP>:3000` 접속 (맥 IP: `ipconfig getifaddr en0`)

## 규칙 요약

- 날짜는 한국시간(Asia/Seoul) 기준. 자정에 새 날
- 성경 +1, 다짐 +1 (각각 하루 1회) · 기도부탁 +3 · 비대면 권유 +5 · 대면 권유 +7 (관리자 승인 시)
- 단계: 0–199 / 200–399 / 400–699 / 700–999 / 1000+
- 총점은 `data/ledger.json`의 합

## 배포 (나중에)

Vercel에 이 레포를 연결하고 Vercel Marketplace에서 Upstash Redis 스토어를 추가하면
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`(또는 통합에 따라 `KV_REST_API_URL`/
`KV_REST_API_TOKEN`)이 자동 주입되어 저장소가 Redis로 전환됩니다.
자세한 절차는 구현 완료 후 별도 안내.
