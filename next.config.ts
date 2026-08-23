import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 서버를 같은 Wi-Fi의 휴대폰에서 열어 테스트할 때 필요하다.
  // Next 16은 localhost가 아닌 출처의 /_next/* 요청을 기본으로 차단하므로,
  // 이 목록이 없으면 휴대폰에서 HTML은 보이지만 JS가 전혀 실행되지 않는다
  // (버튼이 죽고, 폼은 페이지 새로고침으로 제출된다).
  // 맥의 Wi-Fi IP가 바뀌면 여기도 바꿔야 한다 (`ipconfig getifaddr en0`).
  // 프로덕션 빌드에는 영향이 없다.
  allowedDevOrigins: ["192.168.0.16"],
};

export default nextConfig;
