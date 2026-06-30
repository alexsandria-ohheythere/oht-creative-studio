// ---------------------------------------------------------------------------
// Google Drive integration helpers (OAuth + Drive REST, no SDK — plain fetch).
//
// One workspace-wide connection authenticates as ohheythere.group@gmail.com.
// We store ONLY a refresh token (in public.google_tokens, command-RLS locked)
// and mint short-lived access tokens on demand.
//
// Scope used: https://www.googleapis.com/auth/drive.file
//   -> the app can only see/manage files & folders it creates itself. It can
//      NOT read the rest of the user's Drive. This is intentional and minimal.
//
// Env vars required (set in Vercel → Project → Settings → Environment Variables):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REDIRECT_URI   = https://oht-creative-studio.vercel.app/api/google/callback
//   GOOGLE_ROOT_FOLDER_ID (optional) — a Drive folder ID to nest everything under.
//                                      If unset, folders are created in My Drive root.
// ---------------------------------------------------------------------------

import { createClient } from './supabase-server';

const ACCOUNT = 'ohheythere.group'; // single-row key in google_tokens
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

// Build the consent URL the user is sent to. `state` is round-tripped back to
// the callback so we can guard against CSRF and know where to return.
export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: env('GOOGLE_REDIRECT_URI'),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',     // <- needed to receive a refresh_token
    prompt: 'consent',          // <- force refresh_token even on re-auth
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

// Exchange an authorization code for tokens, then persist the refresh token.
export async function exchangeCodeAndStore(code) {
  const body = new URLSearchParams({
    code,
    client_id: env('GOOGLE_CLIENT_ID'),
    client_secret: env('GOOGLE_CLIENT_SECRET'),
    redirect_uri: env('GOOGLE_REDIRECT_URI'),
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token exchange failed');
  if (!data.refresh_token) {
    throw new Error('No refresh_token returned. Revoke the app at myaccount.google.com/permissions and reconnect.');
  }

  const supabase = await createClient();
  const expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  const { data: rows, error } = await supabase
    .from('google_tokens')
    .upsert({
      account: ACCOUNT,
      refresh_token: data.refresh_token,
      access_token: data.access_token || null,
      expiry,
      scope: data.scope || SCOPE,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account' })
    .select();
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    throw new Error('Token not saved — only command users can connect Drive (check RLS / sign in as command).');
  }
  return true;
}

// True if a refresh token is on file (i.e. Drive is connected).
export async function isConnected() {
  const supabase = await createClient();
  const { data } = await supabase.from('google_tokens').select('account').eq('account', ACCOUNT).maybeSingle();
  return !!data;
}

// Get a valid access token, refreshing if we have none cached or it's stale.
async function getAccessToken() {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from('google_tokens').select('*').eq('account', ACCOUNT).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error('Drive is not connected yet.');

  const stillValid = row.access_token && row.expiry && (new Date(row.expiry).getTime() - Date.now() > 60_000);
  if (stillValid) return row.access_token;

  const body = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    client_secret: env('GOOGLE_CLIENT_SECRET'),
    refresh_token: row.refresh_token,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token refresh failed');

  const expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await supabase.from('google_tokens').update({
    access_token: data.access_token,
    expiry,
    updated_at: new Date().toISOString(),
  }).eq('account', ACCOUNT);

  return data.access_token;
}

async function driveFetch(path, init = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Drive API error (${res.status})`);
  return data;
}

// Sanitise a name for safe use as a Drive folder name (and de-dupe queries).
function clean(name) {
  return (name || '').toString().replace(/['\\]/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
}

// Find a child folder by name under a parent, or create it. Idempotent.
async function ensureFolder(name, parentId) {
  const safe = clean(name);
  const parent = parentId || 'root';
  const q = [
    `name = '${safe.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `'${parent}' in parents`,
    'trashed = false',
  ].join(' and ');
  const found = await driveFetch(`/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`);
  if (found.files && found.files.length > 0) return found.files[0].id;

  const created = await driveFetch('/files?fields=id', {
    method: 'POST',
    body: JSON.stringify({
      name: safe,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parent],
    }),
  });
  return created.id;
}

// Make a folder readable+writable by anyone with the link (so artists can
// upload without per-person sharing). Adjust to 'reader' if you only want view.
async function shareAnyoneWriter(folderId) {
  try {
    await driveFetch(`/files/${folderId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ role: 'writer', type: 'anyone' }),
    });
  } catch {
    // Non-fatal: sharing may be restricted by Workspace policy. The folder
    // still exists and command users can share it manually.
  }
}

// Provision (or find) the folder for a single Production card:
//   [root]/ Brand / Channel / Format / <card title>
// Returns { id, url }.
export async function ensureCardFolder({ brand, channel, format, title }) {
  const root = process.env.GOOGLE_ROOT_FOLDER_ID || null;
  const brandId = await ensureFolder(brand || 'Unsorted Brand', root);
  const channelId = await ensureFolder(channel || 'Unsorted Channel', brandId);
  const formatId = await ensureFolder(format || 'General', channelId);
  const cardId = await ensureFolder(title || 'Untitled', formatId);
  await shareAnyoneWriter(cardId);
  return { id: cardId, url: `https://drive.google.com/drive/folders/${cardId}` };
}
