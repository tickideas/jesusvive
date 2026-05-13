# Handoff Prompt — Jesus Vive Brasil Project

Copy everything between the `---` markers below and paste it as your first
message when starting a new Claude Code session inside this folder
(`jesusvive-church/`).

---

I'm continuing work on **Jesus Vive Brasil** — a Next.js 16 registration and
streaming portal for the PDNTP 2026 Global Project Practicum (Brazil zone).
The domain is **jesusvive.church** and the kickoff event is **16 May 2026**.

## Project context

This app captures registrations for a one-day online outreach in Brazil. We
have **18 nominees split across 3 cells**, each targeting a Brazilian city:

- Cell 1 → São Paulo → `/saopaulo`
- Cell 2 → Rio de Janeiro → `/rio`
- Cell 3 → Brasília → `/brasilia`

All cell pages funnel into the same `registrations` table tagged with
`cell_id`, so each cell's Outreach Lead can pull their own leads. Walk-ins on
event day register through `/ao-vivo` and get flagged `source = 'event-walk-in'`.

## Tech stack

- **Next.js 16** (App Router, React 19, `output: 'standalone'`)
- **TypeScript**, **Tailwind CSS**
- **PostgreSQL** + **Drizzle ORM**
- **React Hook Form** + **Zod** + **libphonenumber-js** (BR phone validation)
- **Meta Pixel** baked into the root layout for ad attribution
- **Docker + docker-compose** for **Dokploy** deployment
- Free **wa.me deep-link** for WhatsApp confirmation (Business API is a
  post-MVP TODO)

## Important constraints

- **LGPD compliance is mandatory**: consent checkbox must stay unticked by
  default; IP is hashed before storage; `/privacidade` page exists.
- **Performance budget**: page weight < 200 KB, LCP < 2.5s on 4G. All public
  routes use `export const dynamic = 'force-static'`.
- **All copy is in Brazilian Portuguese (pt-BR)**. English is a TODO toggle on
  `/ao-vivo` only.
- **Note for Next.js 16**: dynamic route `params` and `searchParams` are
  `Promise<...>` — always `await` them in page components.

## Watch pages (per-cell streams)

Each cell has its own live page so cell leaders can run their own broadcast
with their own content moderation:

- `/ao-vivo/saopaulo` → cell-1
- `/ao-vivo/rio` → cell-2
- `/ao-vivo/brasilia` → cell-3
- `/ao-vivo` (bare) → picker page (safety net for misshared links)

E-cards must link directly to the per-city URLs. The stream source per cell
is editable live at `/admin/streams` (HLS, YouTube ID, or Offline) — changes
take effect on the next request, no redeploy.

Player: hls.js with native Safari HLS fallback. Walk-in registrations from a
cell's watch page are auto-tagged to that `cell_id`.

## File map (key files)

```
app/page.tsx                       → / (city picker)
app/[city]/page.tsx                → /saopaulo | /rio | /brasilia
app/obrigado/page.tsx              → Thank-you (WhatsApp + calendar + share)
app/ao-vivo/page.tsx               → Event-day streaming portal
app/ao-vivo/WalkInModal.tsx        → Walk-in registration modal
app/privacidade/page.tsx           → LGPD privacy policy
app/api/register/route.ts          → POST endpoint for all registrations
app/layout.tsx                     → Meta Pixel + fonts
components/RegistrationForm.tsx    → Main form (RHF + Zod + UTM capture)
components/HeroSection.tsx         → City-specific hero
lib/schema.ts                      → Drizzle: registrations table
lib/cells.ts                       → City → cell_id config + copy
lib/validations.ts                 → Zod schemas
lib/whatsapp.ts                    → wa.me deep-link helper
lib/db.ts                          → Postgres client
docker-compose.yml                 → web + postgres for Dokploy
Dockerfile                         → multi-stage, standalone Next output
.env.example                       → env var reference
```

## What's already built (MVP-complete)

- ✅ All 3 cell registration pages (statically generated)
- ✅ Generic `/` city picker
- ✅ Form validation with BR phone format + LGPD consent
- ✅ UTM capture (utm_source/medium/campaign/content)
- ✅ Meta Pixel `Lead` event on successful registration
- ✅ Thank-you page with WhatsApp deep-link, Google Calendar add, and share
- ✅ Event-day streaming portal with YouTube Live embed + walk-in modal
- ✅ LGPD privacy policy page
- ✅ Database schema with indexes on `cell_id`, `whatsapp`, `created_at`
- ✅ IP hashing (SHA-256, truncated) for LGPD
- ✅ Dockerfile + docker-compose for Dokploy
- ✅ Mobile-first responsive design

## Outstanding TODOs (in priority order)

1. ~~**WhatsApp Business API integration**~~ — live with Twilio:
   - `lib/twilio.ts` — `sendWhatsAppTemplate()` for approved templates,
     `sendWhatsAppText()` for free-form replies within the 24h window
   - `app/api/register/route.ts` — sends confirmation template after insert
   - `app/api/cron/reminders/route.ts` — 48h/24h/1h reminders (Bearer
     `CRON_SECRET`, schedule every 15 min)
   - `app/api/twilio/inbound/route.ts` — inbound webhook with Twilio signature
     validation. Configure in Twilio Console → WhatsApp Senders → Messaging
     Endpoint → "Webhook URL for incoming messages":
     `https://jesusvive.church/api/twilio/inbound` (HTTP POST)
   - `app/admin/inbox` — conversation viewer with unread badge, contact
     name lookup, 24h-window-aware reply form.
2. **Email confirmations + reminders** via Resend + cron (Dokploy cron or
   external like `cron-job.org`)
3. ~~**Admin dashboard**~~ — shipped at `/admin`:
   - Basic auth via `middleware.ts` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`)
   - Filters: cell, source, date range, free-text search (name/email/whatsapp)
   - Stat cards: total, last 24h, per-cell counts
   - CSV export at `/api/admin/leads.csv` (honors same filters)
   - **Still TODO:** per-user logins so cell leads only see their own cell
4. **Live prayer wall** on `/ao-vivo/[city]` — leaning toward Socket.io for
   full control or Tawk.to for zero-effort. Note: now one wall per cell.
5. **Language toggle (PT/EN)** on `/ao-vivo` only (not on registration pages —
   ads are pt-BR only)
6. **Exit-intent prompt** on `/ao-vivo`: "Você entregou sua vida a Jesus hoje?"
7. **Recording replay page** post-event for late attendees
8. **Real hero imagery** — currently uses a gradient placeholder
9. **City-specific OG images** for better social previews

## Working agreements

- Honest, direct feedback over agreement. If I'm wrong, say so.
- Keep changes minimal and focused — no speculative refactors.
- Brazilian Portuguese for all user-facing copy. English only in code comments
  and admin areas.
- Mobile-first. Test layouts at 360px width before desktop.
- Don't add comments to code you didn't change.
- Performance budget is sacred — flag anything that would push us past 200 KB.

## How I deploy

- Push to git → Dokploy auto-builds via `docker-compose.yml`
- Postgres runs alongside the web container (in compose) — production data
  lives in the named `pgdata` volume
- I run `docker compose exec web npx drizzle-kit push` once after the first
  deploy to create the schema

## What I'd like to work on next

[Describe the specific task you want to tackle this session, e.g. "Build the
admin dashboard at /admin with basic auth and CSV export" or "Wire up Resend
for email confirmations". If you're not sure, ask me what's most critical for
the upcoming ad launch tomorrow.]

---

## How to use this prompt

1. Open a new Claude Code session inside the `jesusvive-church/` folder.
2. Copy the section above (between the `---` markers).
3. Paste it as your first message.
4. Replace the last paragraph ("What I'd like to work on next") with your
   specific request for that session.
