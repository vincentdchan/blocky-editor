/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: false,
  webpack: function (config) {
    config.experiments = {
      layers: true,
      asyncWebAssembly: true,
    };
    return config;
  },
};

module.exports = nextConfig;
