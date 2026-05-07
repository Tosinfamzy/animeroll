import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Public routes — accessible without a Clerk session.
 *
 * - `/`                      Landing page handles auth at the page level.
 * - `/sign-in(.*)`,
 *   `/sign-up(.*)`           Auth UI itself.
 * - `/share/entry/(.*)`,
 *   `/share/list/(.*)`       Recipient-facing share pages + colocated
 *                            opengraph-image routes. Public by design.
 * - `/api/shares/(.*)/react` Anonymous reactions, keyed by reactor cookie.
 * - `/api/anime/(.*)`        Jikan proxy + cache fetch (IP-rate-limited).
 *
 * Everything else is protected: `auth.protect()` redirects unauthed page
 * requests to /sign-in and returns 401 on unauthed API requests.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/share/entry/(.*)',
  '/share/list/(.*)',
  '/api/shares/(.*)/react',
  '/api/anime/(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
