import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * React's `cache()` only memoises inside a server render, so the behavioural
 * tests live in tests/react-server/ and run in a child process under the
 * `react-server` export condition, rendering through React Flight. This file
 * also pins the call sites.
 */

describe("request-scoped memoisation (react-server build)", () => {
  it("behavioural suite passes", () => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: "" };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "tests/react-server/request-memoisation.rsc.ts"],
      { encoding: "utf8", env }
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /ℹ fail 0/);
  });
});

describe("request-scoped memoisation call sites", () => {
  const source = (file: string) => readFileSync(file, "utf8");

  it("home content, homepage CMS, categories and account session are React cache() wrapped", () => {
    assert.match(source("lib/data/home-content.ts"), /export const getHomeContentRow = cache\(/);
    assert.match(source("lib/data/homepage-cms.ts"), /export const getHomepageCms = cache\(/);
    assert.match(source("lib/data/catalog.ts"), /export const listCategoriesFromDb = cache\(/);
    assert.match(source("lib/data/account-orders.ts"), /export const getAccountSession = cache\(/);
  });

  it("the account session is never placed in a cross-request cache", () => {
    const accountOrders = source("lib/data/account-orders.ts");
    assert.doesNotMatch(accountOrders, /unstable_cache\(|"use cache"|from "next\/cache"/);
  });

  it("the store layout and product page share the account-session lookup", () => {
    const layout = source("app/(store)/layout.tsx");
    assert.match(layout, /getAccountUserEmail\(\)/);
    const page = source("app/(store)/product/[slug]/page.tsx");
    assert.match(page, /getAccountSession\(\)/);
    assert.doesNotMatch(page, /auth\.getUser\(/);
    assert.doesNotMatch(page, /createServerSupabaseClient/);
  });

  it("homepage metadata reuses the request's parsed CMS", () => {
    const page = source("app/(store)/page.tsx");
    const metadataFn = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("/** Local assets"));
    assert.match(metadataFn, /getHomepageCms\(\)/);
    assert.doesNotMatch(metadataFn, /parseHomepageCms/);
  });
});
