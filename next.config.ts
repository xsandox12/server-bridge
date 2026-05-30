import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // 네이티브 모듈 및 Node.js 전용 패키지는 번들링하지 않고 런타임에 require
  serverExternalPackages: ['better-sqlite3', 'dockerode', 'docker-modem', 'ssh2', 'cpu-features', 'sshcrypto'],
};

export default nextConfig;
