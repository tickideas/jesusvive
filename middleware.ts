import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware does two unrelated jobs:
 *
 *  1) Basic-auth gate for /admin and /api/admin/* (credentials from
 *     ADMIN_USERNAME / ADMIN_PASSWORD; fails closed with 503 if unset).
 *
 *  2) Cell-affinity routing for the watch page:
 *     - On /saopaulo, /rio, /brasilia, /ao-vivo/saopaulo etc., set a
 *       `jvb_cell` cookie remembering which cell the visitor belongs to.
 *     - On a bare /ao-vivo hit, redirect to /ao-vivo/<slug> if the cookie
 *       is set; otherwise let the picker page render.
 *     This lets the approved reminder template keep using the shared
 *     `/ao-vivo` URL while still routing each viewer to their own cell
 *     stream.
 */

const REALM = 'jesusvive-admin';

const CELL_COOKIE = 'jvb_cell';
const CELL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const CITY_SLUGS = new Set(['saopaulo', 'rio', 'brasilia']);

function setCellCookie(res: NextResponse, slug: string): void {
  res.cookies.set(CELL_COOKIE, slug, {
    path: '/',
    sameSite: 'lax',
    secure: true,
    httpOnly: false,
    maxAge: CELL_COOKIE_MAX_AGE,
  });
}

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
  const { pathname } = req.nextUrl;

  // --- 1) Admin basic auth -------------------------------------------------
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
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
    if (
      !timingSafeEqual(decoded.slice(0, idx), user) ||
      !timingSafeEqual(decoded.slice(idx + 1), pass)
    ) {
      return unauthorized();
    }
    return NextResponse.next();
  }

  // --- 2) Cell-affinity routing -------------------------------------------
  // Bare /ao-vivo → redirect to /ao-vivo/<cell> if cookie present, unless
  // ?pick=1 (user clicked "trocar" to choose a different cell).
  if (pathname === '/ao-vivo' || pathname === '/ao-vivo/') {
    const wantsPicker = req.nextUrl.searchParams.get('pick') === '1';
    const slug = req.cookies.get(CELL_COOKIE)?.value;
    if (!wantsPicker && slug && CITY_SLUGS.has(slug)) {
      const url = req.nextUrl.clone();
      url.pathname = `/ao-vivo/${slug}`;
      url.search = '';
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  // Visits to a city's registration or watch page → remember the cell.
  // Match: /saopaulo, /rio, /brasilia, /ao-vivo/saopaulo, /ao-vivo/rio,
  //        /ao-vivo/brasilia (trailing slash tolerated).
  const stripped = pathname.replace(/\/$/, '');
  let slugFromPath: string | null = null;
  if (stripped.startsWith('/ao-vivo/')) {
    slugFromPath = stripped.slice('/ao-vivo/'.length);
  } else if (stripped.length > 1) {
    slugFromPath = stripped.slice(1);
  }
  if (slugFromPath && CITY_SLUGS.has(slugFromPath)) {
    const existing = req.cookies.get(CELL_COOKIE)?.value;
    if (existing !== slugFromPath) {
      const res = NextResponse.next();
      setCellCookie(res, slugFromPath);
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/ao-vivo',
    '/ao-vivo/:path*',
    '/saopaulo',
    '/rio',
    '/brasilia',
  ],
};
