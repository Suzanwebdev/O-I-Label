const COLOR_SWATCH: Record<string, string> = {
  black: "#171717",
  white: "#f8f8f7",
  ivory: "#efe7d8",
  cream: "#f3ead8",
  charcoal: "#4b4f54",
  gray: "#6b7280",
  grey: "#6b7280",
  navy: "#212a3f",
  nude: "#d4b59e",
  espresso: "#4a3429",
  burgundy: "#5f2337",
  olive: "#5b5f3f",
  blush: "#ddb5ad",
  brown: "#6b4f3b",
  beige: "#d9c7a8",
  offwhite: "#f5f5f0",
  wine: "#722f37",
  maroon: "#6b2737",
  sand: "#cdbb9a",
  khaki: "#b9a57a",
  tan: "#c19a6b",
  mocha: "#7b5a46",
  chocolate: "#5c3a21",
  silver: "#b8b8b8",
  gold: "#c8a951",
};

export function resolveSwatchColor(rawColor: string): string {
  const value = rawColor.trim();
  if (!value) return "#b7b7b0";

  if (
    /^#([a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(value) ||
    /^(rgb|rgba|hsl|hsla)\(/i.test(value)
  ) {
    return value;
  }

  const compact = value.toLowerCase().replace(/[\s_-]+/g, "");
  const spaced = value.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  const swappedGrey = compact.replace(/grey/g, "gray");
  const candidates = [value, value.toLowerCase(), compact, spaced, swappedGrey];

  // Let the browser resolve any valid CSS color keyword/function.
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    for (const candidate of candidates) {
      if (candidate && CSS.supports("color", candidate)) return candidate;
    }
  }

  return (
    COLOR_SWATCH[compact] ??
    COLOR_SWATCH[swappedGrey] ??
    COLOR_SWATCH[spaced] ??
    COLOR_SWATCH[spaced.replace(/grey/g, "gray")] ??
    "#b7b7b0"
  );
}
