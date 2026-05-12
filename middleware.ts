import { NextRequest, NextResponse } from 'next/server';

/**
 * Basic-auth gate for /admin and /api/admin/*.
 *
 * Credentials come from ADMIN_USERNAME / ADMIN_PASSWORD env vars.
 * If either is unset, the admin surface returns 503 (fail closed) so a
 * misconfigured prod deploy can't accidentally serve leads publicly.
 */

const REALM = 'jesusvive-admin';

function unauthorized(): NextResponse {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    return new NextResponse('Admin disabled (credentials not configured)', {
      status: 503,
    });
  }

  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return unauthorized();

  const submittedUser = decoded.slice(0, idx);
  const submittedPass = decoded.slice(idx + 1);

  if (
    !timingSafeEqual(submittedUser, user) ||
    !timingSafeEqual(submittedPass, pass)
  ) {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
