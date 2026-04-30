import fs from "node:fs";
import type { NextConfig } from "next";

/** Real project path — matches subst drives (e.g. `X:\`) to their underlying folder so Turbopack and PostCSS agree on root. */
function projectFilesystemRoot(): string {
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

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: projectFilesystemRoot(),
  },
  images: {
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
