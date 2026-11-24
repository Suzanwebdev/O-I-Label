import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("closed storefront waitlist dialog hydration safety", () => {
  const shell = read("components/store-control/closed-page-shell.tsx");
  const presale = read("components/store-control/presale-launch-page.tsx");
  const page = read("app/closed/[slug]/page.tsx");

  it("does not import or mount DialogTrigger (avoids Radix SSR/client aria-id mismatches)", () => {
    for (const src of [shell, presale]) {
      const withoutBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, "");
      assert.equal(/\bDialogTrigger\b/.test(withoutBlockComments), false);
      assert.match(src, /from "@\/components\/ui\/dialog"/);
    }
  });

  it("uses a controlled Dialog open state with a plain trigger button", () => {
    for (const src of [shell, presale]) {
      assert.match(src, /const \[waitlistOpen, setWaitlistOpen\] = React\.useState\(false\)/);
      assert.match(src, /waitlistTriggerRef/);
      assert.match(src, /<Dialog open=\{waitlistOpen\} onOpenChange=\{setWaitlistOpen\}>/);
      assert.match(src, /aria-haspopup="dialog"/);
      assert.match(src, /aria-expanded=\{waitlistOpen\}/);
      assert.match(src, /onClick=\{\(\) => setWaitlistOpen\(true\)\}/);
      assert.match(src, /onCloseAutoFocus=\{/);
      assert.match(src, /waitlistTriggerRef\.current\?\.focus\(\)/);
    }
  });

  it("keeps VipWaitlistForm and accessible dialog chrome", () => {
    for (const src of [shell, presale]) {
      assert.match(src, /VipWaitlistForm/);
      assert.match(src, /DialogContent/);
      assert.match(src, /DialogTitle/);
      assert.match(src, /DialogDescription/);
    }
  });

  it("attributes waitlist source from the closed-page slug", () => {
    assert.match(page, /waitlistSourceBySlug/);
    assert.match(page, /waitlistSource:\s*waitlistSourceBySlug\[slug\]/);
    assert.match(shell, /source=\{model\.waitlistSource \?\? "pre-launch"\}/);
    assert.match(presale, /source="presale"/);
  });

  it("marks decorative overlays as non-interactive", () => {
    assert.match(shell, /pointer-events-none absolute inset-0 bg-black\/35/);
    assert.match(presale, /pointer-events-none absolute inset-0 bg-black\/35/);
  });
});
