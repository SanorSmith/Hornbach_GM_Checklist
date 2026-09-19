import { NextResponse, type NextRequest } from 'next/server';

/**
 * Page-level gate only.
 *
 * This checks that a session cookie *exists* and bounces anonymous visitors to
 * the login screen. It deliberately does NOT unseal or trust the cookie: that
 * happens in `requireUser()` / `requireUserOrRedirect()`, which also verify the
 * `sessions` row server-side.
 *
 * `/api` is not listed as public and is not "covered" by this file either —
 * every route handler authorizes itself. Assuming middleware protects the API
 * is how APIs end up wide open.
 */
const PUBLIC_PAGE_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PAGE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has('gm_session');
  if (hasSessionCookie) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?returnTo=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Pages only. API routes, static assets and image optimisation are excluded
    // here because they are authorized (or public) by their own handlers.
    '/((?!api|_next/static|_next/image|favicon.ico|icons|sounds|manifest.webmanifest).*)',
  ],
};
