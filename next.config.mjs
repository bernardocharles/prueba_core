/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Fotos de tickets desde el celular pueden pesar varios MB
    serverActions: { bodySizeLimit: "12mb" },
    serverComponentsExternalPackages: ["@prisma/client", "bullmq", "ioredis"],
  },
};

export default nextConfig;
