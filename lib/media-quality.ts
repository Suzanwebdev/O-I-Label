/** Keep original quality for uploaded catalog assets hosted in Supabase Storage. */
export function shouldBypassImageOptimization(src: string): boolean {
  if (!src || src.startsWith("/")) return false;
  return src.includes("/storage/v1/object/public/product-images/");
}

