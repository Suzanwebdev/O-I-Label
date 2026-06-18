# Supabase auth email templates

Paste these into **Supabase Dashboard → Authentication → Email Templates** (or enable custom SMTP and upload the HTML bodies).

## Branded sender (required)

Default mail comes from **Supabase Auth**. To send as **O & I Label**:

1. **Resend** → verify your domain (e.g. `oandilabel.com`).
2. **Supabase → Project Settings → Authentication → SMTP Settings** → Enable custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL)
   - Username: `resend`
   - Password: your `RESEND_API_KEY`
   - Sender email: `noreply@oandilabel.com` (must match verified domain)
   - Sender name: `O & I Label`
3. Save and send a test signup email.

## Subjects

| Template | Suggested subject |
|----------|-------------------|
| Confirm signup | `Confirm your O & I Label account` |
| Reset password | `Reset your O & I Label password` |

## Redirect URLs

**Authentication → URL Configuration**

- Site URL: `https://www.oandilabel.com`
- Redirect URLs: `https://www.oandilabel.com/auth/callback**` and `https://oandilabel.com/auth/callback**`
