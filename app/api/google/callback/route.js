import { NextResponse } from 'next/server';
import { exchangeCodeAndStore } from '../../../../lib/google-drive';

// GET /api/google/callback?code=...&state=...
// Google redirects here after the user consents.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error');

  const back = (status) => NextResponse.redirect(new URL(`/dashboard?drive=${status}`, request.url), { status: 303 });

  if (err) return back('denied');
  if (!code) return back('error');

  // CSRF: the state must match the cookie we set in /connect.
  const cookieState = request.cookies.get('g_oauth_state')?.value;
  if (!cookieState || cookieState !== state) return back('badstate');

  try {
    await exchangeCodeAndStore(code);
    const res = back('connected');
    res.cookies.delete('g_oauth_state');
    return res;
  } catch (e) {
    console.error('Google callback error:', e?.message);
    return back('error');
  }
}
