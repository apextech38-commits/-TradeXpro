/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@deriv/core'],
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
