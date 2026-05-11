# Jesus Vive Brasil — Registration & Streaming Portal

Next.js 14 app for the **Jesus Vive Brasil** outreach (16 May 2026), built for
the PDNTP Global Project Practicum (Brazil zone).

## Routes

| Route | Purpose |
|---|---|
| `/` | Generic landing — city picker |
| `/saopaulo` | Cell 1 registration page |
| `/rio` | Cell 2 registration page |
| `/brasilia` | Cell 3 registration page |
| `/obrigado` | Thank-you page (WhatsApp confirm + calendar + share) |
| `/ao-vivo` | Event-day streaming portal (player + walk-in form) |
| `/privacidade` | LGPD privacy policy |
| `/api/register` | POST endpoint for all form submissions |

All registrations land in the same `registrations` table tagged with `cell_id`
and `source` (`pre-reg` vs `event-walk-in`).

## Local development

```bash
npm install
cp .env.example .env
# edit .env — set DATABASE_URL to your local Postgres
npm run db:push        # create the schema
npm run dev            # http://localhost:3000
```

## Deploy to Dokploy

1. Push this repo to your git remote.
2. In Dokploy, create a new **Compose** application pointing at `docker-compose.yml`.
3. Set environment variables in Dokploy:
   - `DATABASE_URL` — Postgres connection string (use the bundled `db` service or external)
   - `POSTGRES_PASSWORD`
   - `NEXT_PUBLIC_WHATSAPP_NUMBER` — your Brazilian (+55) WhatsApp number
   - `NEXT_PUBLIC_META_PIXEL_ID` — for ad attribution
   - `NEXT_PUBLIC_YOUTUBE_LIVE_ID` — (event day) the unlisted YouTube Live video ID
4. Point `jesusvive.church` (and any subdomain) at the Dokploy traefik proxy.
5. Run the schema migration once: `docker compose exec web npx drizzle-kit push`.

## Performance budget

- Page weight target: **< 200 KB**
- LCP target: **< 2.5s on 4G**
- All city pages use `force-static` for instant first paint.
- Inter + Poppins preloaded; no client JS on hero.

## LGPD compliance

- Explicit consent checkbox, **unticked by default**.
- Privacy policy at `/privacidade` listing rights, retention, contact.
- IP address is SHA-256 hashed and truncated before storage.
- No cross-border data transfer beyond hosting (Dokploy).
- Users can request deletion via the WhatsApp contact in the policy.

## TODOs (post-MVP)

- [ ] WhatsApp Business API integration (Take Blip / Wati) for automated confirmation templates
- [ ] Email confirmations + 48h/24h/1h reminders (Resend + cron)
- [ ] Admin dashboard at `/admin` (basic-auth) for cell leads to export their leads
- [ ] Live prayer wall on `/ao-vivo` (Socket.io or Tawk.to)
- [ ] Language toggle (PT/EN) on the streaming portal
- [ ] Exit-intent prompt on `/ao-vivo`
- [ ] Recording auto-save and replay page after the event
