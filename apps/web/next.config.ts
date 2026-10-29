import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Ignore lint errors during production build (linting is handled separately in CI/pre-commit)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
