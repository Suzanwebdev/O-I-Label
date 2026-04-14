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

**One secret required:** in GitHub → **Settings → Secrets and variables → Actions**, add:

- **`VERCEL_TOKEN`** — create at [vercel.com/account/tokens](https://vercel.com/account/tokens). The token must be able to deploy the **o-i-label** project (same account/team as in Vercel).

The workflow uses **committed** `.vercel/project.json` (project + team IDs). You do **not** need `VERCEL_ORG_ID` or `VERCEL_PROJECT_ID` in GitHub anymore.

Builds run on **Vercel** using environment variables you already set in the Vercel project dashboard.

If deploys still fail, regenerate `VERCEL_TOKEN`, or connect the repo under **Vercel → Project → Settings → Git** so Vercel deploys from Git directly.
