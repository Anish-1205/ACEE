import { NextResponse, type NextRequest } from 'next/server';

/** Fast redirect to login when there is no session cookie. Real authorisation is enforced by the API. */
export function proxy(req: NextRequest) {
  if (!req.cookies.has('acee_session')) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/counselor/:path*', '/trainer/:path*', '/admin/:path*'] };
