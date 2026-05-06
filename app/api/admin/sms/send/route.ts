import { NextResponse } from "next/server";
import { getRequestAuthz } from "@/lib/authz";
import { sendMoolreSms } from "@/lib/sms/moolre";

/**
 * POST /api/admin/sms/send
 * Body: { senderid?: string, messages: { recipient: string, message: string, ref?: string }[] }
 * senderid defaults to MOOLRE_SMS_SENDER_ID when omitted.
 */
export async function POST(request: Request) {
  const authz = await getRequestAuthz();
  if (!authz.isAdmin || !authz.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { senderid?: unknown; messages?: unknown };

  const defaultSender = process.env.MOOLRE_SMS_SENDER_ID?.trim() ?? "";
  const senderidRaw = typeof b.senderid === "string" ? b.senderid.trim() : "";
  const senderid = senderidRaw || defaultSender;

  if (!senderid) {
    return NextResponse.json(
      { error: "senderid is required in the body, or set MOOLRE_SMS_SENDER_ID in the environment" },
      { status: 400 }
    );
  }

  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return NextResponse.json({ error: "messages must be a non-empty array" }, { status: 400 });
  }

  const messages: { recipient: string; message: string; ref?: string }[] = [];
  for (const row of b.messages) {
    if (!row || typeof row !== "object") {
      return NextResponse.json({ error: "Each message must be an object" }, { status: 400 });
    }
    const r = row as { recipient?: unknown; message?: unknown; ref?: unknown };
    const recipient = typeof r.recipient === "string" ? r.recipient.trim() : "";
    const message = typeof r.message === "string" ? r.message.trim() : "";
    const ref = typeof r.ref === "string" && r.ref.trim() ? r.ref.trim() : undefined;
    if (!recipient || !message) {
      return NextResponse.json(
        { error: "Each message must include non-empty recipient and message strings" },
        { status: 400 }
      );
    }
    messages.push(ref ? { recipient, message, ref } : { recipient, message });
  }

  try {
    const result = await sendMoolreSms({ senderid, messages });
    return NextResponse.json({ ok: true, code: result.code, message: result.message, raw: result.raw });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMS send failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
