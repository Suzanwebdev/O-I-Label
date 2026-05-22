import fs from "node:fs";
import type { NextConfig } from "next";

/** Windows/subst-drive dev only — omitted on Vercel (breaks modifyConfig if set there). */
function devTurbopackRoot(): string | undefined {
  if (process.env.VERCEL) return undefined;
  try {
    return fs.realpathSync.native(process.cwd());
  } catch {
    try {
      return fs.realpathSync(process.cwd());
    } catch {
      return process.cwd();
    }
  }
}

const turbopackRoot = devTurbopackRoot();

const nextConfig: NextConfig = {
  output: "standalone",
  ...(turbopackRoot ? { turbopack: { root: turbopackRoot } } : {}),
  images: {
    qualities: [75, 95, 100],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
