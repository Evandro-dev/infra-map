import type { NextConfig } from 'next';
const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
const apiUrl = new URL(apiOrigin);
if (
  !['http:', 'https:'].includes(apiUrl.protocol) ||
  apiUrl.username ||
  apiUrl.password ||
  apiUrl.pathname !== '/' ||
  apiUrl.search ||
  apiUrl.hash
) {
  throw new Error('API_INTERNAL_URL deve ser uma origem HTTP(S), sem caminho ou credenciais.');
}
const nextConfig: NextConfig = {
  distDir: process.env.INFRA_MAP_E2E === 'true' ? '.next-e2e' : '.next',
  typescript: {
    tsconfigPath: process.env.INFRA_MAP_E2E === 'true' ? 'tsconfig.e2e.json' : 'tsconfig.json',
  },
  reactStrictMode: true,
  typedRoutes: true,
  // Uma coleta pode consultar várias fontes com timeouts individuais antes de responder.
  experimental: { proxyTimeout: 100_000 },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiUrl.origin}/api/v1/:path*` }];
  },
};
export default nextConfig;
