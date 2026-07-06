'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

// =====================================================================
// Marketing Collaterals — independent from the social pipeline.
// Tables: mc_themes, mc_items (backs both Line Up and Assembly), mc_assets.
// RLS mirrors the existing conventions:
//   mc_themes / mc_items -> brand_id in user_brand_ids()  (same as campaigns/content_items)
//   mc_assets            -> current_role() = 'command'    (same as brand_templates)
// =====================================================================

function has(formData, key) {
  return formData.get(key) !== null;
}
function setIfPresent(dest, formData, key, transform) {
  if (has(formData, key)) dest[key] = transform(formData.get(key));
}
const trimStr = (v) => (v || '').trim();
const trimOrNull = (v) => trimStr(v) || null;

function safeJson(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------- THEME
// Same shape/spirit as saveCampaign — a brand-scoped initiative with a
// goal, dates, status, and pillars that become pickable on Line Up rows.
export async function saveTheme(prevState, formData) {
  const id = formData.get('id');
  const brand_id = formData.get('brand_id');
  const name = trimStr(formData.get('name'));

  if (!brand_id) return { error: 'Pick a brand first.' };
  if (!name) return { error: 'Theme name is required.' };

  const supabase = await createClient();
  const payload = { brand_id, name };

  setIfPresent(payload, formData, 'goal', trimOrNull);
  setIfPresent(payload, formData, 'status', (v) => v || 'planning');
  setIfPresent(payload, formData, 'starts_on', (v) => v || null);
  setIfPresent(payload, formData, 'ends_on', (v) => v || null);
  setIfPresent(payload, formData, 'pillars', (v) => safeJson(v, []));

  let error;
  if (id) {
    ({ error } = await supabase.from('mc_themes').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('mc_themes').insert(payload));
  }
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteTheme(prevState, formData) {
  const id = formData.get('id');
  if (!id) return { error: 'Missing theme id.' };

  const supabase = await createClient();
  const { error } = await supabase.from('mc_themes').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}

// ------------------------------------------------------------- LINE UP
// mc_items — one row per thing that needs producing. saveItem merges onto
// the existing row (setIfPresent pattern) so a single-cell edit from the
// Line Up table never clobbers the rest of the row — this is what makes
// inline, per-cell autosave safe.
export async function saveItem(prevState, formData) {
  const id = formData.get('id');
  const brand_id = formData.get('brand_id');

  // brand_id is required for a new row; on edits it's only required if
  // actually present in the submission (per-cell edits won't include it).
  if (!id && !brand_id) return { error: 'Pick a brand first.' };

  const supabase = await createClient();
  const payload = {};
  if (!id) payload.brand_id = brand_id;

  setIfPresent(payload, formData, 'brand_id', trimStr);
  setIfPresent(payload, formData, 'theme_id', (v) => v || null);
  setIfPresent(payload, formData, 'pillar', trimOrNull);
  setIfPresent(payload, formData, 'kind', trimOrNull);
  setIfPresent(payload, formData, 'title', trimStr);
  setIfPresent(payload, formData, 'notes', trimOrNull);
  setIfPresent(payload, formData, 'status', (v) => v || 'queued');
  setIfPresent(payload, formData, 'due_date', (v) => v || null);
  setIfPresent(payload, formData, 'attachments', (v) => safeJson(v, []));

  if (!id && !payload.title) payload.title = 'Untitled';

  let error, data;
  if (id) {
    ({ error, data } = await supabase.from('mc_items').update(payload).eq('id', id).select().single());
  } else {
    ({ error, data } = await supabase.from('mc_items').insert(payload).select().single());
  }
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true, item: data };
}

export async function setItemStatus(prevState, formData) {
  const id = formData.get('id');
  const status = formData.get('status');
  if (!id || !status) return { error: 'Missing item or status.' };

  const supabase = await createClient();
  const { error } = await supabase.from('mc_items').update({ status }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function setItemAttachments(prevState, formData) {
  const id = formData.get('id');
  const attachments = formData.get('attachments');
  if (!id) return { error: 'Missing item id.' };

  const supabase = await createClient();
  const { error } = await supabase.from('mc_items').update({ attachments: safeJson(attachments, []) }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteItem(prevState, formData) {
  const id = formData.get('id');
  if (!id) return { error: 'Missing item id.' };

  const supabase = await createClient();
  const { error } = await supabase.from('mc_items').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}

// -------------------------------------------------------------- ASSETS
// mc_assets — uploaded files scoped to Marketing Collaterals. Mirrors
// asset-actions.js exactly, pointed at mc_assets/mc_items instead of
// assets/content_items. Reuses the same 'brand-assets' Storage bucket.
const ALLOWED_KIND = ['image', 'video', 'doc'];

export async function saveMcAsset(prevState, formData) {
  const brand_id = trimStr(formData.get('brand_id'));
  const storage_path = trimStr(formData.get('storage_path'));
  let kind = trimStr(formData.get('kind'));
  const item_id = trimStr(formData.get('item_id')) || null;

  if (!brand_id) return { error: 'Pick a brand for this asset.' };
  if (!storage_path) return { error: 'No file was uploaded.' };
  if (!ALLOWED_KIND.includes(kind)) kind = 'doc';

  const supabase = await createClient();
  const { error } = await supabase.from('mc_assets').insert({ brand_id, storage_path, kind, item_id });
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteMcAsset(prevState, formData) {
  const id = formData.get('id');
  const storage_path = trimStr(formData.get('storage_path'));
  if (!id) return { error: 'Missing asset id.' };

  const supabase = await createClient();
  const { error } = await supabase.from('mc_assets').delete().eq('id', id);
  if (error) return { error: error.message };

  if (storage_path) {
    await supabase.storage.from('brand-assets').remove([storage_path]);
  }

  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}
