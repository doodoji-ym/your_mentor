import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 사진 업로드 서버 액션 — 기본 1MB로는 폰 사진이 막힘 (클라에서 압축도 함)
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
