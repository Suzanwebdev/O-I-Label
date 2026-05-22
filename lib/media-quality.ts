/** Serve Supabase Storage uploads as-is (no Next.js recompression or downscaling). */
export function shouldBypassImageOptimization(src: string): boolean {
  if (!src || src.startsWith("/")) return false;
  return src.includes("/storage/v1/object/public/product-images/");
}

