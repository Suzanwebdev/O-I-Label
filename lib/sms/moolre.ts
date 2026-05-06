/**
 * Moolre SMS — POST https://api.moolre.com/open/sms/send
 * Docs: requires header `X-API-VASKEY`. Optional test header `X-Scenario-Key`.
 */

const MOOLRE_SMS_URL = "https://api.moolre.com/open/sms/send";

const MAX_SENDER_ID_LEN = 11;
const MAX_MESSAGES_PER_REQUEST = 100;

export type MoolreSmsMessage = {
  recipient: string;
  message: string;
  ref?: string;
};

export async function sendMoolreSms(params: {
  senderid: string;
  messages: MoolreSmsMessage[];
}): Promise<{ status: number; code?: string; message?: string; raw: unknown }> {
  const vasKey = process.env.MOOLRE_SMS_VASKEY?.trim();
  if (!vasKey) {
    throw new Error("MOOLRE_SMS_VASKEY is not set");
  }

  const senderid = params.senderid.trim();
  if (!senderid || senderid.length > MAX_SENDER_ID_LEN) {
    throw new Error(`senderid is required and must be at most ${MAX_SENDER_ID_LEN} characters`);
  }

  if (!params.messages.length) {
    throw new Error("messages must be a non-empty array");
  }
  if (params.messages.length > MAX_MESSAGES_PER_REQUEST) {
    throw new Error(`At most ${MAX_MESSAGES_PER_REQUEST} messages per request`);
  }

  const messages = params.messages.map((m) => {
    const recipient = m.recipient.trim();
    const message = m.message.trim();
    const ref = m.ref?.trim();
    if (!recipient || !message) {
      throw new Error("Each message requires recipient and message");
    }
    return ref ? { recipient, message, ref } : { recipient, message };
  });

  const headers: Record<string, string> = {
    "X-API-VASKEY": vasKey,
    "Content-Type": "application/json",
  };
  const scenario = process.env.MOOLRE_SMS_SCENARIO_KEY?.trim();
  if (scenario) {
    headers["X-Scenario-Key"] = scenario;
  }

  const res = await fetch(MOOLRE_SMS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: 1,
      senderid,
      messages,
    }),
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Moolre SMS returned non-JSON (${res.status})`);
  }

  const parsed = json as { status?: number; code?: string; message?: string };

  if (!res.ok || parsed.status !== 1) {
    const msg = parsed.message || `Moolre SMS failed (${res.status})`;
    throw new Error(msg);
  }

  return {
    status: parsed.status ?? 1,
    code: parsed.code,
    message: parsed.message,
    raw: json,
  };
}
