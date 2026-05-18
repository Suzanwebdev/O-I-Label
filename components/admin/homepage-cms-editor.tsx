"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HERO_SLIDES_MAX,
  type HomepageCms,
  type HomeHeroSlideStored,
  type FooterColumn,
  type FooterLink,
} from "@/lib/home/homepage-cms";

const BUCKET = "product-images";

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "image";
}

function newSlide(): HomeHeroSlideStored {
  return {
    id: `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    src: "",
    alt: "Hero image",
  };
}

export function HomepageCmsEditor({ initial }: { initial: HomepageCms }) {
  const router = useRouter();
  const [cms, setCms] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCms(initial);
  }, [initial]);

  async function save() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/homepage/cms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cms),
      });
      const json = (await res.json()) as { error?: string; cms?: HomepageCms };
      if (!res.ok) {
        setError(json.error ?? "Could not save homepage");
        return;
      }
      if (json.cms) setCms(json.cms);
      setOk("Homepage saved. Changes are live on the storefront.");
      router.refresh();
    } catch {
      setError("Network error while saving");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSlide(id: string, file: File | null) {
    if (!file?.type.startsWith("image/")) {
      setError("Choose an image file for the slide.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const path = `homepage/hero/${Date.now()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (data?.publicUrl) {
        setCms((prev) => ({
          ...prev,
          hero: {
            ...prev.hero,
            slides: prev.hero.slides.map((s) =>
              s.id === id ? { ...s, src: data.publicUrl } : s
            ),
          },
        }));
      }
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function patchHero<K extends keyof HomepageCms["hero"]>(key: K, value: HomepageCms["hero"][K]) {
    setCms((prev) => ({ ...prev, hero: { ...prev.hero, [key]: value } }));
  }

  function patchCta(which: "primary_cta" | "secondary_cta", field: "label" | "href", value: string) {
    setCms((prev) => ({
      ...prev,
      hero: {
        ...prev.hero,
        [which]: { ...prev.hero[which], [field]: value },
      },
    }));
  }

  function moveSlide(id: string, delta: -1 | 1) {
    setCms((prev) => {
      const slides = [...prev.hero.slides];
      const i = slides.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= slides.length) return prev;
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...prev, hero: { ...prev.hero, slides } };
    });
  }

  function updateFooterColumn(colIndex: number, patch: Partial<FooterColumn>) {
    setCms((prev) => {
      const columns = prev.footer.columns.map((c, i) =>
        i === colIndex ? { ...c, ...patch } : c
      );
      return { ...prev, footer: { ...prev.footer, columns } };
    });
  }

  function updateFooterLink(colIndex: number, linkIndex: number, patch: Partial<FooterLink>) {
    setCms((prev) => {
      const columns = prev.footer.columns.map((col, ci) => {
        if (ci !== colIndex) return col;
        const links = col.links.map((l, li) => (li === linkIndex ? { ...l, ...patch } : l));
        return { ...col, links };
      });
      return { ...prev, footer: { ...prev.footer, columns } };
    });
  }

  function addFooterLink(colIndex: number) {
    setCms((prev) => {
      const columns = prev.footer.columns.map((col, ci) =>
        ci === colIndex
          ? { ...col, links: [...col.links, { label: "New link", href: "/" }] }
          : col
      );
      return { ...prev, footer: { ...prev.footer, columns } };
    });
  }

  function removeFooterLink(colIndex: number, linkIndex: number) {
    setCms((prev) => {
      const columns = prev.footer.columns.map((col, ci) => {
        if (ci !== colIndex) return col;
        return { ...col, links: col.links.filter((_, li) => li !== linkIndex) };
      });
      return { ...prev, footer: { ...prev.footer, columns } };
    });
  }

  function addSocialLink() {
    setCms((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        social: [...prev.footer.social, { label: "TikTok", href: "https://" }],
      },
    }));
  }

  function removeSocialLink(index: number) {
    setCms((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        social: prev.footer.social.filter((_, i) => i !== index),
      },
    }));
  }

  function updateSocialLink(index: number, patch: Partial<{ label: string; href: string }>) {
    setCms((prev) => {
      const social = prev.footer.social.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...prev, footer: { ...prev.footer, social } };
    });
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hero — text &amp; buttons</CardTitle>
          <CardDescription>Main banner at the top of the homepage.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="hero-eyebrow">Eyebrow</Label>
            <Input
              id="hero-eyebrow"
              value={cms.hero.eyebrow}
              onChange={(e) => patchHero("eyebrow", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="hero-headline">Headline</Label>
            <Input
              id="hero-headline"
              value={cms.hero.headline}
              onChange={(e) => patchHero("headline", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="hero-subtext">Subtext</Label>
            <textarea
              id="hero-subtext"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={cms.hero.subtext}
              onChange={(e) => patchHero("subtext", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Primary button</Label>
            <Input
              placeholder="Label"
              value={cms.hero.primary_cta.label}
              onChange={(e) => patchCta("primary_cta", "label", e.target.value)}
            />
            <Input
              placeholder="/shop"
              value={cms.hero.primary_cta.href}
              onChange={(e) => patchCta("primary_cta", "href", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Secondary button</Label>
            <Input
              placeholder="Label"
              value={cms.hero.secondary_cta.label}
              onChange={(e) => patchCta("secondary_cta", "label", e.target.value)}
            />
            <Input
              placeholder="/shop?tag=best_seller"
              value={cms.hero.secondary_cta.href}
              onChange={(e) => patchCta("secondary_cta", "href", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hero — slider images</CardTitle>
          <CardDescription>
            {cms.hero.slides.length} of {HERO_SLIDES_MAX} slides. Upload or paste an image URL. Order is
            left-to-right in the carousel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cms.hero.slides.map((slide, index) => (
            <div key={slide.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row">
              <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-md bg-muted sm:h-32 sm:w-48">
                {slide.src ? (
                  <Image src={slide.src} alt="" fill className="object-cover" sizes="192px" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={index === 0 || busy}
                    onClick={() => moveSlide(slide.id, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={index === cms.hero.slides.length - 1 || busy}
                    onClick={() => moveSlide(slide.id, 1)}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      setCms((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          slides: prev.hero.slides.filter((s) => s.id !== slide.id),
                        },
                      }))
                    }
                  >
                    Remove
                  </Button>
                </div>
                <Input
                  placeholder="Image URL"
                  value={slide.src}
                  onChange={(e) =>
                    setCms((prev) => ({
                      ...prev,
                      hero: {
                        ...prev.hero,
                        slides: prev.hero.slides.map((s) =>
                          s.id === slide.id ? { ...s, src: e.target.value } : s
                        ),
                      },
                    }))
                  }
                />
                <Input
                  placeholder="Alt text"
                  value={slide.alt}
                  onChange={(e) =>
                    setCms((prev) => ({
                      ...prev,
                      hero: {
                        ...prev.hero,
                        slides: prev.hero.slides.map((s) =>
                          s.id === slide.id ? { ...s, alt: e.target.value } : s
                        ),
                      },
                    }))
                  }
                />
                <Input
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadSlide(slide.id, f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          ))}
          {cms.hero.slides.length < HERO_SLIDES_MAX ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setCms((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, slides: [...prev.hero.slides, newSlide()] },
                }))
              }
            >
              Add slide
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promo band</CardTitle>
          <CardDescription>Optional full-width strip on the homepage (below hero).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cms.promo_band.enabled}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  promo_band: { ...prev.promo_band, enabled: e.target.checked },
                }))
              }
            />
            Show promo band
          </label>
          <Input
            placeholder="Title"
            value={cms.promo_band.title}
            onChange={(e) =>
              setCms((prev) => ({
                ...prev,
                promo_band: { ...prev.promo_band, title: e.target.value },
              }))
            }
          />
          <Input
            placeholder="Subtitle"
            value={cms.promo_band.subtitle}
            onChange={(e) =>
              setCms((prev) => ({
                ...prev,
                promo_band: { ...prev.promo_band, subtitle: e.target.value },
              }))
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Button label"
              value={cms.promo_band.cta}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  promo_band: { ...prev.promo_band, cta: e.target.value },
                }))
              }
            />
            <Input
              placeholder="Link (/shop/...)"
              value={cms.promo_band.href}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  promo_band: { ...prev.promo_band, href: e.target.value },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Homepage section labels</CardTitle>
          <CardDescription>Headings for category row, occasion strip, and best sellers.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Shop by category</p>
            <Input
              value={cms.homepage_sections.shop_category.eyebrow}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    shop_category: {
                      ...prev.homepage_sections.shop_category,
                      eyebrow: e.target.value,
                    },
                  },
                }))
              }
            />
            <Input
              placeholder="Link label"
              value={cms.homepage_sections.shop_category.link_label}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    shop_category: {
                      ...prev.homepage_sections.shop_category,
                      link_label: e.target.value,
                    },
                  },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Shop by occasion</p>
            <Input
              value={cms.homepage_sections.occasion.eyebrow}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    occasion: { ...prev.homepage_sections.occasion, eyebrow: e.target.value },
                  },
                }))
              }
            />
            <Input
              value={cms.homepage_sections.occasion.title}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    occasion: { ...prev.homepage_sections.occasion, title: e.target.value },
                  },
                }))
              }
            />
            <Input
              placeholder="CTA label"
              value={cms.homepage_sections.occasion.cta_label}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    occasion: { ...prev.homepage_sections.occasion, cta_label: e.target.value },
                  },
                }))
              }
            />
            <Input
              placeholder="CTA link"
              value={cms.homepage_sections.occasion.cta_href}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    occasion: { ...prev.homepage_sections.occasion, cta_href: e.target.value },
                  },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Best sellers</p>
            <Input
              value={cms.homepage_sections.best_sellers.eyebrow}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    best_sellers: {
                      ...prev.homepage_sections.best_sellers,
                      eyebrow: e.target.value,
                    },
                  },
                }))
              }
            />
            <Input
              value={cms.homepage_sections.best_sellers.title}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    best_sellers: {
                      ...prev.homepage_sections.best_sellers,
                      title: e.target.value,
                    },
                  },
                }))
              }
            />
            <Input
              placeholder="View all label"
              value={cms.homepage_sections.best_sellers.link_label}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  homepage_sections: {
                    ...prev.homepage_sections,
                    best_sellers: {
                      ...prev.homepage_sections.best_sellers,
                      link_label: e.target.value,
                    },
                  },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Footer</CardTitle>
          <CardDescription>
            Link columns and social icons. Newsletter copy stays fixed in the layout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-2">
            <Label>Copyright brand name</Label>
            <Input
              value={cms.footer.copyright_brand}
              onChange={(e) =>
                setCms((prev) => ({
                  ...prev,
                  footer: { ...prev.footer, copyright_brand: e.target.value },
                }))
              }
            />
          </div>
          {cms.footer.columns.map((col, colIndex) => (
            <div key={`${col.title}-${colIndex}`} className="space-y-3 rounded-lg border p-4">
              <Label>Column title</Label>
              <Input
                value={col.title}
                onChange={(e) => updateFooterColumn(colIndex, { title: e.target.value })}
              />
              {col.links.map((link, linkIndex) => (
                <div key={linkIndex} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    placeholder="Label"
                    value={link.label}
                    onChange={(e) => updateFooterLink(colIndex, linkIndex, { label: e.target.value })}
                  />
                  <Input
                    placeholder="/path"
                    value={link.href}
                    onChange={(e) => updateFooterLink(colIndex, linkIndex, { href: e.target.value })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => removeFooterLink(colIndex, linkIndex)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="secondary" onClick={() => addFooterLink(colIndex)}>
                Add link
              </Button>
            </div>
          ))}
          <div className="space-y-3">
            <p className="text-sm font-medium">Social links</p>
            <p className="text-xs text-muted-foreground">
              Use labels like Instagram, WhatsApp, or TikTok so the right icon appears. Other labels use a
              generic link icon.
            </p>
            {cms.footer.social.map((s, i) => (
              <div
                key={`${i}-${s.label}-${s.href}`}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  placeholder="Label (e.g. TikTok)"
                  value={s.label}
                  onChange={(e) => updateSocialLink(i, { label: e.target.value })}
                />
                <Input
                  placeholder="https://..."
                  value={s.href}
                  onChange={(e) => updateSocialLink(i, { href: e.target.value })}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={cms.footer.social.length <= 1}
                  onClick={() => removeSocialLink(i)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={addSocialLink}>
              Add social link
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save homepage"}
        </Button>
      </div>
    </div>
  );
}
