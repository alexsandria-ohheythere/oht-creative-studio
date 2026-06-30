import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { ensureCardFolder, isConnected } from '../../../../lib/google-drive';

// POST /api/google/folder   body: { content_id }
// Idempotently provisions the Drive folder for a Production card and stores
// drive_folder_id / drive_folder_url on the content_items row.
// Returns { url, id } or { error }.
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let content_id;
  try {
    ({ content_id } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Bad request body.' }, { status: 400 });
  }
  if (!content_id) return NextResponse.json({ error: 'Missing content_id.' }, { status: 400 });

  if (!(await isConnected())) {
    return NextResponse.json({ error: 'Drive is not connected yet.' }, { status: 409 });
  }

  // Load the card (RLS ensures the user may see it) + its brief for channel/format.
  const { data: card, error: cErr } = await supabase
    .from('content_items')
    .select('id, brand_id, brief_id, title, drive_folder_id, drive_folder_url')
    .eq('id', content_id)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
  if (!card) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });

  // Already provisioned → return what we have (idempotent).
  if (card.drive_folder_url) {
    return NextResponse.json({ url: card.drive_folder_url, id: card.drive_folder_id });
  }

  const { data: brand } = await supabase
    .from('brands').select('name').eq('id', card.brand_id).maybeSingle();
  let channel = null, format = null;
  if (card.brief_id) {
    const { data: brief } = await supabase
      .from('briefs').select('channel, format').eq('id', card.brief_id).maybeSingle();
    channel = brief?.channel || null;
    format = brief?.format || null;
  }

  let folder;
  try {
    folder = await ensureCardFolder({
      brand: brand?.name, channel, format, title: card.title,
    });
  } catch (e) {
    console.error('ensureCardFolder failed:', e?.message);
    return NextResponse.json({ error: e?.message || 'Drive folder creation failed.' }, { status: 502 });
  }

  // Stamp the row. .select() so a silent RLS zero-row write is caught.
  const { data: upd, error: uErr } = await supabase
    .from('content_items')
    .update({ drive_folder_id: folder.id, drive_folder_url: folder.url })
    .eq('id', content_id)
    .select();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  if (!upd || upd.length === 0) {
    // Folder exists in Drive but we couldn't save the link (permission). Still
    // return the URL so the artist isn't blocked.
    return NextResponse.json({ url: folder.url, id: folder.id, warning: 'Created in Drive but not saved to the card (check permissions).' });
  }

  return NextResponse.json({ url: folder.url, id: folder.id });
}
