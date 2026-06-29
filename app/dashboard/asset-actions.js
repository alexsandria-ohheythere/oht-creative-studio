'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

// Asset Library writes. Mirrors campaign-actions: writes go through the server
// with the user's session, and RLS on public.assets enforces who can write.
//
// Real table shape (live schema):
//   id, brand_id (uuid -> brands.id), content_id (uuid -> content_items.id, nullable),
//   storage_path (text), kind ('image'|'video'|'doc'), created_at
//
// Files are uploaded to the 'brand-assets' Storage bucket on the client (same
// pattern the Brand form already uses), then this action records the row.

const ALLOWED_KIND = ['image', 'video', 'doc'];

export async function saveAsset(prevState, formData) {
  const brand_id = (formData.get('brand_id') || '').trim();
  const storage_path = (formData.get('storage_path') || '').trim();
  let kind = (formData.get('kind') || '').trim();
  const content_id = (formData.get('content_id') || '').trim() || null;

  if (!brand_id) return { error: 'Pick a brand for this asset.' };
  if (!storage_path) return { error: 'No file was uploaded.' };
  if (!ALLOWED_KIND.includes(kind)) kind = 'doc';

  const supabase = await createClient();
  const payload = { brand_id, storage_path, kind, content_id };
  const { error } = await supabase.from('assets').insert(payload);

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteAsset(prevState, formData) {
  const id = formData.get('id');
  const storage_path = (formData.get('storage_path') || '').trim();
  if (!id) return { error: 'Missing asset id.' };

  const supabase = await createClient();

  // Remove the DB row first (RLS-guarded). If that succeeds, best-effort delete
  // the underlying file so storage doesn't accumulate orphans.
  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) return { error: error.message };

  if (storage_path) {
    // storage_path is stored as the object key within the bucket.
    await supabase.storage.from('brand-assets').remove([storage_path]);
  }

  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}
