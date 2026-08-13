/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "sharp",
      "@prisma/client",
      "@ffmpeg-installer/ffmpeg",
      "@ffprobe-installer/ffprobe",
    ],
  },
};

export default nextConfig;
