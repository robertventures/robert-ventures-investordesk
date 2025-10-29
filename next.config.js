const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router is enabled by default in Next.js 13.4+
  // Note: CSP headers are now handled in middleware.js with nonce-based security
  
  // Reduce hydration warnings in development
  reactStrictMode: true,
  
  // Suppress hydration warnings for browser extensions
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Exclude directories from webpack watching to avoid "too many open files" error
  webpack: (config, { isServer }) => {
    // Provide path alias so imports like '@/lib/...' resolve to project root
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(process.cwd())
    }
    
  // Reduce watcher pressure to avoid EMFILE on macOS/Linux
  // - Ignore heavy directories entirely (backend, node_modules, etc.)
  // - Allow switching to polling via WATCHPACK_POLLING=true
  const ignoredWatchGlobs = [
    '**/node_modules/**',
    '**/.git/**',
    '**/backend/**',
    '**/backend/venv/**',
    '**/.next/**',
    '**/venv/**',
    '**/__pycache__/**',
    '**/*.pyc'
  ]

  config.watchOptions = {
    ...config.watchOptions,
    ...(process.env.WATCHPACK_POLLING === 'true' ? { poll: 800 } : {}),
    ignored: ignoredWatchGlobs,
    aggregateTimeout: 300
  }
  
  // Additional optimization: reduce file system checks
  config.snapshot = {
    ...config.snapshot,
    managedPaths: [path.resolve(process.cwd(), 'node_modules')],
    immutablePaths: [
      path.resolve(process.cwd(), 'backend')
    ]
  }
    
    return config
  }
}

module.exports = nextConfig
