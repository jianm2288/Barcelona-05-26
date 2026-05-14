/** @type {import('next').NextConfig} */
const isExport = process.env.NEXT_OUTPUT !== "standalone" && process.env.NODE_ENV !== "development";

const nextConfig = {
  ...(isExport ? { output: "export" } : {}),
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
