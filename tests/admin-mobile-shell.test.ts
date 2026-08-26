import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(process.cwd());

describe("Admin mobile shell (Phase 4G.1)", () => {
  it("hides the desktop sidebar below md and keeps it visible at md+", () => {
    const sidebar = readFileSync(join(root, "components/admin/admin-sidebar.tsx"), "utf8");
    assert.match(sidebar, /hidden.*md:block/);
    assert.match(sidebar, /w-64 shrink-0/);
  });

  it("provides a mobile drawer navigation with shared admin nav", () => {
    const mobileNav = readFileSync(join(root, "components/admin/admin-mobile-nav.tsx"), "utf8");
    const navMenu = readFileSync(join(root, "components/admin/admin-nav-menu.tsx"), "utf8");
    const nav = readFileSync(join(root, "lib/admin/nav.ts"), "utf8");

    assert.match(mobileNav, /AdminMobileNav/);
    assert.match(mobileNav, /side="left"/);
    assert.match(mobileNav, /AdminNavMenu/);
    assert.match(navMenu, /ADMIN_NAV_GROUPS/);
    assert.match(nav, /\/admin\/website-health/);
    assert.match(nav, /Website Health/);
  });

  it("wires the admin shell layout with full-width mobile main content", () => {
    const layout = readFileSync(join(root, "app/admin/layout.tsx"), "utf8");
    const shell = readFileSync(join(root, "components/admin/admin-shell.tsx"), "utf8");

    assert.match(layout, /AdminShell/);
    assert.match(shell, /AdminTopbar/);
    assert.match(shell, /AdminSidebar/);
    assert.match(shell, /AdminMobileNav/);
    assert.match(shell, /max-md:overflow-x-hidden/);
    assert.match(shell, /min-w-0 w-full flex-1/);
  });

  it("adds a mobile menu button to the topbar without changing desktop storefront link", () => {
    const topbar = readFileSync(join(root, "components/admin/admin-topbar.tsx"), "utf8");

    assert.match(topbar, /Open admin menu/);
    assert.match(topbar, /md:hidden/);
    assert.match(topbar, /View storefront/);
    assert.match(topbar, /hidden text-xs text-neutral-600 hover:text-black md:inline/);
    assert.match(topbar, /\/admin\/website-health/);
  });
});
