# O & I Label — deployment & production checklist

## 1. GitHub → Vercel (required for auto-deploy)

Every push to `main` runs **CI** (lint + build). **Production deploy** runs only when a secret is set.

### Option A — Deploy Hook (recommended)

1. Vercel → project **o-i-label** → **Settings** → **Git** → **Deploy Hooks**
2. Create hook: name `github-main`, branch **Production** `main`
3. GitHub → **Suzanwebdev/O-I-Label** → **Settings** → **Secrets and variables** → **Actions**
4. New secret: **`VERCEL_DEPLOY_HOOK`** = paste the hook URL

### Option B — Vercel token

1. Create token at https://vercel.com/account/tokens
2. GitHub secret: **`VERCEL_TOKEN`**
3. Repo already includes `.vercel/project.json`

### Option C — Vercel Git integration

Vercel → **Settings** → **Git** → connect **Suzanwebdev/O-I-Label**, production branch **`main`**.

This can deploy even when GitHub Actions deploy is skipped.

---

## 2. Vercel environment variables

Copy from `.env.example` into **Vercel → Project → Settings → Environment Variables** (Production + Preview).

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/admin (never expose to client) |
| `NEXT_PUBLIC_APP_URL` / `APP_BASE_URL` | `https://www.oandilabel.com` |
| `RESEND_API_KEY` / `RESEND_FROM` | Order & notification email |
| `MOOLRE_*` | Live checkout payments |
| `MOOLRE_SMS_*` / `SMS_SENDER_ID` | Order SMS notifications |

Redeploy after changing env vars.

---

## 3. Supabase

- Migrations applied on the production project
- Storage buckets: `product-images`, `blog-covers` (public read where intended)
- Moolre webhook URL: `https://www.oandilabel.com/api/webhooks/moolre`

---

## 4. Resend & Moolre (live commerce)

- **Resend:** verified sending domain; `RESEND_FROM` matches that domain
- **Moolre:** merchant keys in Vercel; webhook secret matches dashboard
- **SMS:** approved sender ID and sufficient balance

---

## 5. Manual deploy

Vercel dashboard → **Deployments** → **Redeploy** latest `main`, or:

```bash
npx vercel deploy --prod
```

---

## 6. Verify after deploy

- [ ] Homepage / shop / product pages load
- [ ] Mobile header: centred logo, tight right icons
- [ ] `/blog` (Style Journal) loads; published posts open
- [ ] Test checkout (small amount) → payment webhook → order email/SMS
- [ ] Admin order notify + invoice
