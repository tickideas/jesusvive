import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    whatsapp: text('whatsapp').notNull(), // E.164 format
    email: text('email'),
    city: text('city').notNull(),
    cellId: text('cell_id').notNull(), // 'cell-1' | 'cell-2' | 'cell-3'
    language: text('language').notNull().default('pt-BR'),
    lgpdConsent: boolean('lgpd_consent').notNull().default(false),
    lgpdConsentAt: timestamp('lgpd_consent_at', { withTimezone: true }),
    source: text('source').notNull().default('pre-reg'), // 'pre-reg' | 'event-walk-in'
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // WhatsApp delivery tracking (Twilio templates). NULL = not sent.
    confirmationSentAt: timestamp('confirmation_sent_at', { withTimezone: true }),
    reminder48hSentAt: timestamp('reminder_48h_sent_at', { withTimezone: true }),
    reminder24hSentAt: timestamp('reminder_24h_sent_at', { withTimezone: true }),
    reminder1hSentAt: timestamp('reminder_1h_sent_at', { withTimezone: true }),
  },
  (table) => ({
    cellIdx: index('reg_cell_idx').on(table.cellId),
    whatsappIdx: index('reg_whatsapp_idx').on(table.whatsapp),
    createdAtIdx: index('reg_created_at_idx').on(table.createdAt),
  }),
);

export type Registration = typeof registrations.$inferSelect;
export type NewRegistration = typeof registrations.$inferInsert;

/**
 * Per-cell live stream configuration. One row per cell. The `/ao-vivo/[city]`
 * watch page reads this on each request (with a short cache) so admins can
 * swap the stream URL mid-event without a redeploy.
 *
 * source = 'offline' → show "a transmissão começará em breve"
 * source = 'hls'     → use `url` as the .m3u8 manifest
 * source = 'youtube' → use `url` as the YouTube video ID (fallback)
 */
export const streamConfigs = pgTable('stream_configs', {
  cellId: text('cell_id').primaryKey(), // 'cell-1' | 'cell-2' | 'cell-3'
  source: text('source').notNull().default('offline'), // 'offline' | 'hls' | 'youtube'
  url: text('url'),
  title: text('title'),
  note: text('note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by'),
});

export type StreamConfig = typeof streamConfigs.$inferSelect;
export type NewStreamConfig = typeof streamConfigs.$inferInsert;

/**
 * Inbound + outbound WhatsApp messages, for the /admin/inbox view.
 *
 * direction = 'in'  → customer → us (via Twilio webhook)
 * direction = 'out' → us → customer (operator reply OR automated template)
 *
 * `whatsapp` is the customer's E.164 number (NOT our sender), so the inbox
 * groups by counterparty regardless of direction.
 */
export const whatsappMessages = pgTable(
  'whatsapp_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    whatsapp: text('whatsapp').notNull(), // counterparty E.164
    direction: text('direction').notNull(), // 'in' | 'out'
    body: text('body'),
    twilioSid: text('twilio_sid'),
    status: text('status'), // delivery status for 'out'
    readAt: timestamp('read_at', { withTimezone: true }), // set when an operator opens the inbox
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    whatsappIdx: index('msg_whatsapp_idx').on(table.whatsapp),
    createdAtIdx: index('msg_created_at_idx').on(table.createdAt),
  }),
);

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert;
