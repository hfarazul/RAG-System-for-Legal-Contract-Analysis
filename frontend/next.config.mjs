/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Turbopack (Next.js 16 default)
  turbopack: {},

  // Allow server components to use external packages
  serverExternalPackages: ['ai', '@ai-sdk/openai'],
};

export default nextConfig;
