const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router is enabled by default in Next.js 13.4+
  // Note: CSP headers are now handled in middleware.js with nonce-based security
  webpack: (config) => {
    // Provide path alias so imports like '@/lib/...' resolve to project root
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(process.cwd())
    }
    return config
  }
}

module.exports = nextConfig
