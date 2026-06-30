/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // AntD 5 tối ưu import — tránh tải cả bundle
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/nextjs-registry'],
};

export default nextConfig;
