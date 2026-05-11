/**
 * WhatsApp deep-link helper.
 *
 * Produces a wa.me URL that opens a chat with the cell's number
 * pre-populated with a greeting in Portuguese.
 *
 * TODO: replace with WhatsApp Business API (Take Blip / Wati) for automated
 * confirmation templates after MVP launch.
 */

export function buildWhatsAppLink(message: string): string {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+5511999999999').replace(/\D/g, '');
  const text = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${text}`;
}
