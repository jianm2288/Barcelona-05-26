/** @type {import('next').NextConfig} */
// The app now talks to Neon + Vercel Blob through API routes, so it has to run
// as a Vercel Function deployment, not a static export. Setting
// NEXT_OUTPUT=export at build time can be used to opt back into a static build
// (e.g. for archive snapshots), but it disables photo/note persistence.
const isExport = process.env.NEXT_OUTPUT === "export";

const nextConfig = {
  ...(isExport ? { output: "export" } : {}),
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
