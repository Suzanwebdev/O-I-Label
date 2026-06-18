import { HOME_HERO_SLIDES, type HomeHeroSlide } from "@/lib/home-hero-slides";

export const HERO_SLIDES_MIN = 1;
export const HERO_SLIDES_MAX = 6;

export type HomeCta = { label: string; href: string };

export type HomeHeroSlideStored = {
  id: string;
  src: string;
  alt: string;
};

export type HomeHeroCms = {
  eyebrow: string;
  headline: string;
  subtext: string;
  primary_cta: HomeCta;
  secondary_cta: HomeCta;
  slides: HomeHeroSlideStored[];
};

export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterSocialLink = { label: string; href: string };

export type HomeFooterCms = {
  columns: FooterColumn[];
  social: FooterSocialLink[];
  copyright_brand: string;
};

export type HomePromoBandCms = {
  enabled: boolean;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
};

export type HomeSectionLabelsCms = {
  shop_category: { eyebrow: string; link_label: string };
  occasion: { eyebrow: string; title: string; cta_label: string; cta_href: string };
  best_sellers: { eyebrow: string; title: string; link_label: string };
};

export type HomepageCms = {
  hero: HomeHeroCms;
  footer: HomeFooterCms;
  promo_band: HomePromoBandCms;
  homepage_sections: HomeSectionLabelsCms;
};

export const DEFAULT_HERO_COPY: Omit<HomeHeroCms, "slides"> = {
  eyebrow: "The O & I Label edit",
  headline: "Minimal. Elegant. Timeless.",
  subtext:
    "Premium essentials with a clean feminine silhouette and modern editorial confidence.",
  primary_cta: { label: "Shop now", href: "/shop" },
  secondary_cta: { label: "View lookbook", href: "/shop?tag=best_seller" },
};

export const DEFAULT_FOOTER: HomeFooterCms = {
  copyright_brand: "O & I Label",
  columns: [
    {
      title: "Shop",
      links: [
        { href: "/shop", label: "All products" },
        { href: "/shop/new-arrivals", label: "New Arrivals" },
        { href: "/shop?tag=best_seller", label: "Best Sellers" },
        { href: "/blog", label: "Shop The Look" },
      ],
    },
    {
      title: "Support",
      links: [
        { href: "/contact", label: "Help & Contact" },
        { href: "/policies/shipping", label: "Shipping & Delivery" },
        { href: "/contact?topic=size-guide", label: "Size Guide" },
        { href: "/contact?topic=faq", label: "FAQs" },
        { href: "/track-order", label: "Track My Order" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: "/about", label: "Our story" },
        { href: "/blog", label: "Style Journal" },
        { href: "/policies/privacy", label: "Privacy" },
        { href: "/policies/terms", label: "Terms" },
      ],
    },
  ],
  social: [
    {
      label: "Instagram",
      href: "https://www.instagram.com/o_and_i_label/",
    },
    {
      label: "WhatsApp",
      href: "https://api.whatsapp.com/send?phone=233503163721&text=Hello%20O%20%26%20I%20Label%2C%20I%20need%20help%20with%20an%20order.",
    },
  ],
};

export const DEFAULT_PROMO_BAND: HomePromoBandCms = {
  enabled: false,
  title: "New season essentials",
  subtitle: "Discover the latest drop — limited pieces, timeless silhouettes.",
  href: "/shop/new-arrivals",
  cta: "Shop new arrivals",
};

export const DEFAULT_SECTION_LABELS: HomeSectionLabelsCms = {
  shop_category: { eyebrow: "Shop by category", link_label: "Shop all" },
  occasion: {
    eyebrow: "Shop by occasion",
    title: "Clean pieces. Strong looks.",
    cta_label: "View lookbook",
    cta_href: "/shop",
  },
  best_sellers: {
    eyebrow: "Best sellers",
    title: "The pieces everyone wants.",
    link_label: "View all",
  },
};

function defaultSlidesStored(): HomeHeroSlideStored[] {
  return HOME_HERO_SLIDES.map((s, i) => ({
    id: `default-${i}`,
    src: s.src,
    alt: s.alt,
  }));
}

function parseCta(raw: unknown, fallback: HomeCta): HomeCta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  const href = typeof o.href === "string" ? o.href.trim() : "";
  return {
    label: label || fallback.label,
    href: href || fallback.href,
  };
}

function parseSlides(raw: unknown): HomeHeroSlideStored[] {
  if (!Array.isArray(raw)) return defaultSlidesStored();
  const slides: HomeHeroSlideStored[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const src = typeof o.src === "string" ? o.src.trim() : "";
    if (!src) continue;
    const id =
      typeof o.id === "string" && o.id
        ? o.id
        : `slide-${slides.length}-${Date.now().toString(36)}`;
    const alt = typeof o.alt === "string" ? o.alt.trim() : "Hero image";
    slides.push({ id, src, alt });
    if (slides.length >= HERO_SLIDES_MAX) break;
  }
  return slides.length ? slides : defaultSlidesStored();
}

function parseHero(raw: unknown): HomeHeroCms {
  const base = { ...DEFAULT_HERO_COPY, slides: defaultSlidesStored() };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  return {
    eyebrow: typeof o.eyebrow === "string" ? o.eyebrow : base.eyebrow,
    headline: typeof o.headline === "string" ? o.headline : base.headline,
    subtext: typeof o.subtext === "string" ? o.subtext : base.subtext,
    primary_cta: parseCta(o.primary_cta, base.primary_cta),
    secondary_cta: parseCta(o.secondary_cta, base.secondary_cta),
    slides: parseSlides(o.slides),
  };
}

function parseFooterLinks(raw: unknown): FooterLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const label = typeof o.label === "string" ? o.label.trim() : "";
      const href = typeof o.href === "string" ? o.href.trim() : "";
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((x): x is FooterLink => Boolean(x));
}

function parseFooter(raw: unknown): HomeFooterCms {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_FOOTER;
  const o = raw as Record<string, unknown>;
  let columns = DEFAULT_FOOTER.columns;
  if (Array.isArray(o.columns) && o.columns.length) {
    columns = o.columns
      .map((col) => {
        if (!col || typeof col !== "object") return null;
        const c = col as Record<string, unknown>;
        const title = typeof c.title === "string" ? c.title.trim() : "";
        const links = parseFooterLinks(c.links);
        if (!title || !links.length) return null;
        return { title, links };
      })
      .filter((x): x is FooterColumn => Boolean(x));
    if (!columns.length) columns = DEFAULT_FOOTER.columns;
  }
  let social = DEFAULT_FOOTER.social;
  if (Array.isArray(o.social) && o.social.length) {
    social = o.social
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const s = item as Record<string, unknown>;
        const label = typeof s.label === "string" ? s.label.trim() : "";
        const href = typeof s.href === "string" ? s.href.trim() : "";
        if (!label || !href) return null;
        return { label, href };
      })
      .filter((x): x is FooterSocialLink => Boolean(x));
    if (!social.length) social = DEFAULT_FOOTER.social;
  }
  const copyright_brand =
    typeof o.copyright_brand === "string" && o.copyright_brand.trim()
      ? o.copyright_brand.trim()
      : DEFAULT_FOOTER.copyright_brand;
  return { columns, social, copyright_brand };
}

function parsePromoBand(raw: unknown): HomePromoBandCms {
  const base = DEFAULT_PROMO_BAND;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    title: typeof o.title === "string" ? o.title : base.title,
    subtitle: typeof o.subtitle === "string" ? o.subtitle : base.subtitle,
    href: typeof o.href === "string" ? o.href : base.href,
    cta: typeof o.cta === "string" ? o.cta : base.cta,
  };
}

function parseSectionLabels(raw: unknown): HomeSectionLabelsCms {
  const base = DEFAULT_SECTION_LABELS;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  const sc = o.shop_category;
  const oc = o.occasion;
  const bs = o.best_sellers;
  return {
    shop_category:
      sc && typeof sc === "object" && !Array.isArray(sc)
        ? {
            eyebrow:
              typeof (sc as Record<string, unknown>).eyebrow === "string"
                ? (sc as Record<string, string>).eyebrow
                : base.shop_category.eyebrow,
            link_label:
              typeof (sc as Record<string, unknown>).link_label === "string"
                ? (sc as Record<string, string>).link_label
                : base.shop_category.link_label,
          }
        : base.shop_category,
    occasion:
      oc && typeof oc === "object" && !Array.isArray(oc)
        ? {
            eyebrow:
              typeof (oc as Record<string, unknown>).eyebrow === "string"
                ? (oc as Record<string, string>).eyebrow
                : base.occasion.eyebrow,
            title:
              typeof (oc as Record<string, unknown>).title === "string"
                ? (oc as Record<string, string>).title
                : base.occasion.title,
            cta_label:
              typeof (oc as Record<string, unknown>).cta_label === "string"
                ? (oc as Record<string, string>).cta_label
                : base.occasion.cta_label,
            cta_href:
              typeof (oc as Record<string, unknown>).cta_href === "string"
                ? (oc as Record<string, string>).cta_href
                : base.occasion.cta_href,
          }
        : base.occasion,
    best_sellers:
      bs && typeof bs === "object" && !Array.isArray(bs)
        ? {
            eyebrow:
              typeof (bs as Record<string, unknown>).eyebrow === "string"
                ? (bs as Record<string, string>).eyebrow
                : base.best_sellers.eyebrow,
            title:
              typeof (bs as Record<string, unknown>).title === "string"
                ? (bs as Record<string, string>).title
                : base.best_sellers.title,
            link_label:
              typeof (bs as Record<string, unknown>).link_label === "string"
                ? (bs as Record<string, string>).link_label
                : base.best_sellers.link_label,
          }
        : base.best_sellers,
  };
}

export function parseHomepageCms(sections: Record<string, unknown>): HomepageCms {
  return {
    hero: parseHero(sections.hero),
    footer: parseFooter(sections.footer),
    promo_band: parsePromoBand(sections.promo_band),
    homepage_sections: parseSectionLabels(sections.homepage_sections),
  };
}

/** Overlay classes from legacy slide config when using default URLs. */
const overlayBySrc = new Map(
  HOME_HERO_SLIDES.map((s) => [
    s.src,
    {
      mobileOverlayClassName: s.mobileOverlayClassName,
      desktopOverlayClassName: s.desktopOverlayClassName,
    },
  ])
);

/** First hero slide used for link previews — matches carousel order on the storefront. */
export function primaryHeroSlideSrc(stored: HomeHeroSlideStored[]): string {
  const withSrc = stored.filter((s) => s.src.trim());
  const list = (withSrc.length ? withSrc : defaultSlidesStored()).slice(0, HERO_SLIDES_MAX);
  return list[0]?.src ?? HOME_HERO_SLIDES[0].src;
}

export function heroSlidesForUi(stored: HomeHeroSlideStored[]): HomeHeroSlide[] {
  const withSrc = stored.filter((s) => s.src.trim());
  const list = (withSrc.length ? withSrc : defaultSlidesStored()).slice(0, HERO_SLIDES_MAX);
  return list.map((slide) => {
    const overlay = overlayBySrc.get(slide.src);
    return {
      src: slide.src,
      alt: slide.alt,
      mobileOverlayClassName: overlay?.mobileOverlayClassName,
      desktopOverlayClassName: overlay?.desktopOverlayClassName,
    };
  });
}

export function mergeSectionsPatch(
  current: Record<string, unknown>,
  patch: {
    hero?: HomeHeroCms;
    footer?: HomeFooterCms;
    promo_band?: HomePromoBandCms;
    homepage_sections?: HomeSectionLabelsCms;
  }
): Record<string, unknown> {
  const next = { ...current };
  if (patch.hero) next.hero = patch.hero;
  if (patch.footer) next.footer = patch.footer;
  if (patch.promo_band) next.promo_band = patch.promo_band;
  if (patch.homepage_sections) next.homepage_sections = patch.homepage_sections;
  return next;
}

export function validateHeroForSave(hero: HomeHeroCms): string | null {
  if (hero.slides.length < HERO_SLIDES_MIN) return `Add at least ${HERO_SLIDES_MIN} hero slide.`;
  if (hero.slides.length > HERO_SLIDES_MAX) return `At most ${HERO_SLIDES_MAX} hero slides.`;
  if (!hero.headline.trim()) return "Hero headline is required.";
  return null;
}
