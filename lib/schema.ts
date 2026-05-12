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
