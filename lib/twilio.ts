/**
 * Twilio WhatsApp Business API helper.
 *
 * Sends approved Content Template messages (utility category) for:
 *   - Registration confirmation
 *   - 48h / 24h / 1h reminders
 *
 * If TWILIO_ACCOUNT_SID is not set the send is a no-op (logged), so the app
 * still works in dev / before WABA approval lands.
 */

import twilio from 'twilio';

type Client = ReturnType<typeof twilio>;
let cachedClient: Client | null = null;

function getClient(): Client | null {
  if (cachedClient) return cachedClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  cachedClient = twilio(sid, token);
  return cachedClient;
}

/** Format an E.164 number as a WhatsApp address (`whatsapp:+55...`). */
function toWhatsApp(e164: string): string {
  return e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`;
}

export interface SendTemplateArgs {
  /** Recipient phone in E.164, e.g. "+5511999999999". */
  to: string;
  /** Approved Content Template SID, e.g. "HXxxxxxxxxxxxx". */
  contentSid: string;
  /** Positional template variables, e.g. { "1": "Maria", "2": "16/05" }. */
  variables?: Record<string, string>;
}

export interface SendTemplateResult {
  ok: boolean;
  sid?: string;
  skipped?: boolean;
  error?: string;
}

/**
 * Send a WhatsApp template message. Never throws — returns a result so the
 * caller can log without failing the user-facing request.
 */
export async function sendWhatsAppTemplate(
  args: SendTemplateArgs,
): Promise<SendTemplateResult> {
  const client = getClient();
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!client || !from || !args.contentSid) {
    console.warn('[twilio] skipped (missing config)', {
      hasClient: Boolean(client),
      hasFrom: Boolean(from),
      hasContentSid: Boolean(args.contentSid),
    });
    return { ok: false, skipped: true };
  }

  try {
    const message = await client.messages.create({
      from: toWhatsApp(from),
      to: toWhatsApp(args.to),
      contentSid: args.contentSid,
      contentVariables: args.variables ? JSON.stringify(args.variables) : undefined,
    });
    return { ok: true, sid: message.sid };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[twilio] send failed', { to: args.to, error: msg });
    return { ok: false, error: msg };
  }
}
