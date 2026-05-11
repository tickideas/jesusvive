import type { NextRequest } from 'next/server';

// Deployment topology assumption:
//   - In production this app sits behind a TLS terminator / CDN (Cloudflare,
//     nginx, Caddy, Vercel, etc.) that sets a trustworthy client-IP header.
//   - When TRUST_PROXY=1 we prefer, in order:
//       CF-Connecting-IP   (Cloudflare, unspoofable inside their network)
//       True-Client-IP     (Akamai/Cloudflare Enterprise)
//       X-Forwarded-For    (left-most entry; trusts every hop, so only safe
//                           behind a proxy that strips inbound XFF)
//       X-Real-IP          (nginx convention)
//   - In dev or when directly exposed, set TRUST_PROXY=0 so spoofed proxy
//     headers are ignored.
//
// Default is "1" because the supported deployment path uses a proxy. Flip to
// "0" only for setups that publish the container port directly to the public.
const TRUST_PROXY = (process.env.TRUST_PROXY ?? '1') === '1';

let warnedNoIp = false;

export function clientIp(req: NextRequest): string | null {
  if (TRUST_PROXY) {
    const cf = req.headers.get('cf-connecting-ip');
    if (cf) return cf.trim();

    const tci = req.headers.get('true-client-ip');
    if (tci) return tci.trim();

    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first;
    }

    const xrip = req.headers.get('x-real-ip');
    if (xrip) return xrip.trim();
  }

  // Fallback: NextRequest historically exposed `ip` on some runtimes. In Next
  // 16 it is typically undefined; this branch keeps compatibility but should
  // not be relied on for rate limiting.
  const fallback = (req as unknown as { ip?: string }).ip ?? null;

  if (!fallback && !warnedNoIp) {
    warnedNoIp = true;
    console.warn(
      '[clientIp] No client IP available. Rate limiting will degrade to a ' +
        'shared bucket. Run behind a proxy that sets CF-Connecting-IP or ' +
        'X-Forwarded-For and leave TRUST_PROXY=1.',
    );
  }
  return fallback;
}
