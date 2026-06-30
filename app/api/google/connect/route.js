import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { buildAuthUrl } from '../../../../lib/google-drive';

// GET /api/google/connect
// Command users only. Sends the user to Google's consent screen.
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  }

  // Only command users may connect the shared Drive account.
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'command') {
    return NextResponse.redirect(
      new URL('/dashboard?drive=forbidden', request.url),
      { status: 303 }
    );
  }

  // A simple state token, stored in a short-lived cookie for CSRF protection.
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });
  return res;
}
