import type { MetadataRoute } from "next";

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Entity-escapes the five XML special characters (required for sitemap URLs by the sitemaps.org protocol). */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]!);
}

/**
 * Sitemap XML in the same layout as Next's generated sitemap route, for the fields
 * this site uses (url, lastModified, changeFrequency, priority); image, video and
 * alternate-language fields are not emitted. Every value is XML-escaped.
 */
export function serializeSitemap(entries: MetadataRoute.Sitemap): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const entry of entries) {
    xml += "<url>\n";
    xml += `<loc>${escapeXml(entry.url)}</loc>\n`;
    if (entry.lastModified) {
      const lastModified =
        entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified;
      xml += `<lastmod>${escapeXml(lastModified)}</lastmod>\n`;
    }
    if (entry.changeFrequency) {
      xml += `<changefreq>${escapeXml(entry.changeFrequency)}</changefreq>\n`;
    }
    if (typeof entry.priority === "number") {
      xml += `<priority>${entry.priority}</priority>\n`;
    }
    xml += "</url>\n";
  }
  xml += "</urlset>\n";
  return xml;
}
