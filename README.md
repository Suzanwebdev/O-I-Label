This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Automatic Vercel deploys

On every push to `main`, GitHub Actions runs `.github/workflows/vercel-production.yml`.

**Recommended (most reliable):** add a repository secret named **`VERCEL_DEPLOY_HOOK`** whose value is the **Deploy Hook URL** from Vercel:

1. Open the **o-i-label** project on Vercel → **Settings** → **Git** → **Deploy Hooks**
2. **Create Hook** (name e.g. `github-main`, branch **Production**: `main`)
3. Copy the hook URL → GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** → name **`VERCEL_DEPLOY_HOOK`**, paste URL

The hook URL embeds authorization, so you avoid CLI token / scope problems.

**Alternative:** secret **`VERCEL_TOKEN`** only (from [vercel.com/account/tokens](https://vercel.com/account/tokens)), plus committed **`.vercel/project.json`** in this repo (already included).

**Also:** under **Vercel → Project → Settings → Git**, connect **Suzanwebdev/O-I-Label** and production branch **`main`** so Vercel can deploy from Git even when Actions is misconfigured.
