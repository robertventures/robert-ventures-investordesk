/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router is enabled by default in Next.js 13.4+
  
  webpack: (config, { webpack }) => {
    // Ignore optional/gitignored modules during build
    // lib/seedWealthblockAccounts.js is gitignored for security (contains real PII)
    // It's only loaded dynamically at runtime if present
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /seedWealthblockAccounts\.js$/,
      })
    )
    
    return config
  },
}

export default nextConfig
