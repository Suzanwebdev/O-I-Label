import { enforceRateLimit } from "@/lib/http/rate-limit";
import { escapeHtml } from "@/lib/orders/format-address";
import { createRestockUnsubscribeStore } from "@/lib/restock-notifications/unsubscribe-store";
import {
  processRestockUnsubscribe,
  restockUnsubscribeUserMessage,
} from "@/lib/restock-notifications/unsubscribe";

function htmlPage(message: string, ok: boolean): Response {
  const title = ok ? "Unsubscribed — O & I Label" : "Unsubscribe — O & I Label";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: #f7f5f2;
      color: #1a1a1a;
    }
    main {
      width: 100%;
      max-width: 28rem;
      background: #fff;
      border: 1px solid #e8e2da;
      border-radius: 12px;
      padding: 2rem 1.5rem;
      text-align: center;
      box-shadow: 0 12px 40px -28px rgba(0,0,0,.35);
    }
    .brand {
      font-family: Georgia, "Times New Roman", Times, serif;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-size: 0.95rem;
      margin: 0 0 1.25rem;
    }
    p {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.65;
      color: #6d6560;
    }
    a {
      display: inline-block;
      margin-top: 1.5rem;
      color: #1a1a1a;
      text-decoration: underline;
      text-underline-offset: 3px;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <main>
    <p class="brand">O &amp; I Label</p>
    <p>${escapeHtml(message)}</p>
    <a href="/shop">Continue shopping</a>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "restock:unsubscribe", 30);
  if (limited) return limited;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  let store;
  try {
    store = createRestockUnsubscribeStore();
  } catch {
    return htmlPage("This unsubscribe link is invalid or no longer available.", false);
  }

  let outcome;
  try {
    outcome = await processRestockUnsubscribe(token, store);
  } catch {
    return htmlPage("This unsubscribe link is invalid or no longer available.", false);
  }

  const message = restockUnsubscribeUserMessage(outcome);
  return htmlPage(message, outcome.ok);
}
