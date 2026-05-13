/**
 * Twilio inbound WhatsApp webhook.
 *
 * Configure in Twilio Console → Messaging → Senders → WhatsApp senders →
 * (your sender) → Messaging Endpoint Configuration → "Webhook URL for
 * incoming messages":
 *
 *   https://jesusvive.church/api/twilio/inbound  (HTTP POST)
 *
 * Signature is validated against TWILIO_AUTH_TOKEN. Requests that fail
 * validation are rejected with 403 to prevent spoofed inbound messages.
 *
 * Replies a minimal valid TwiML body so Twilio doesn't surface a 4xx as an
 * error in its console.
 */

import { NextRequest } from 'next/server';
import twilio from 'twilio';
import { db } from '@/lib/db';
import { whatsappMessages } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMPTY_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twimlResponse(status = 200): Response {
  return new Response(EMPTY_TWIML, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

/** Strip the `whatsapp:` prefix Twilio adds to addresses. */
function stripPrefix(v: string | null): string {
  if (!v) return '';
  return v.startsWith('whatsapp:') ? v.slice('whatsapp:'.length) : v;
}

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio-in] TWILIO_AUTH_TOKEN missing, dropping inbound');
    return twimlResponse(503);
  }

  // Twilio posts application/x-www-form-urlencoded.
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const paramsObj: Record<string, string> = {};
  params.forEach((v, k) => {
    paramsObj[k] = v;
  });

  // Twilio signs the full public URL it called. Trust the proxy headers
  // (TRUST_PROXY=1 in the app) to reconstruct https://jesusvive.church/...
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const url = `${proto}://${host}${req.nextUrl.pathname}`;
  const signature = req.headers.get('x-twilio-signature') || '';

  // In dev or when explicitly disabled, skip signature check.
  const skipValidation = process.env.TWILIO_SKIP_SIGNATURE_VALIDATION === '1';
  if (!skipValidation) {
    const valid = twilio.validateRequest(authToken, signature, url, paramsObj);
    if (!valid) {
      console.warn('[twilio-in] invalid signature', { url, signature });
      return twimlResponse(403);
    }
  }

  const from = stripPrefix(params.get('From'));
  const body = params.get('Body') || '';
  const sid = params.get('MessageSid') || params.get('SmsMessageSid') || null;

  if (!from) {
    console.warn('[twilio-in] missing From, ignoring');
    return twimlResponse(200);
  }

  try {
    await db.insert(whatsappMessages).values({
      whatsapp: from,
      direction: 'in',
      body,
      twilioSid: sid,
      status: null,
    });
  } catch (err) {
    console.error('[twilio-in] insert failed', err);
    // Still return 200 so Twilio doesn't retry into a broken DB forever.
  }

  return twimlResponse(200);
}
