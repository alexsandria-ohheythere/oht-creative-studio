'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

// All writes go through the server with the user's session.
// RLS ("command writes brands") enforces that only command users can write.

function safeJson(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function parseMessaging(raw) {
  // Accept newline- or comma-separated pillars, trim blanks.
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// --- Merge helpers -----------------------------------------------------
// The form may submit a partial set of fields (e.g. only the fields whose
// tab was mounted). To avoid wiping data that wasn't in this submission,
// we only set a key when its field is actually present in the FormData,
// and we merge onto the existing row.

function has(formData, key) {
  return formData.get(key) !== null;
}
// Set dest[key] = transform(value) ONLY if the form actually sent `key`.
function setIfPresent(dest, formData, key, transform) {
  if (has(formData, key)) {
    dest[key] = transform(formData.get(key));
  }
}

const trimStr = (v) => (v || '').trim();

export async function saveBrand(prevState, formData) {
  const id = formData.get('id'); // present when editing
  const name = (formData.get('name') || '').trim();

  if (!name) {
    return { error: 'Brand name is required.' };
  }

  const supabase = await createClient();

  // Load the existing row first so we MERGE rather than overwrite. This is
  // the core fix: any field not submitted keeps its previous value.
  let existing = null;
  if (id) {
    const { data, error: readErr } = await supabase
      .from('brands')
      .select('*')
      .eq('id', id)
      .single();
    if (readErr) {
      return { error: 'Could not load existing brand to update: ' + readErr.message };
    }
    existing = data;
  }

  const prevBook =
    existing && existing.brand_book && typeof existing.brand_book === 'object'
      ? existing.brand_book
      : {};

  // ---- Top-level brand columns ----
  // Start from the existing row (or {} for new), then overlay submitted fields.
  const payload = existing ? {} : {};
  payload.name = name; // name is always present and required

  setIfPresent(payload, formData, 'tagline', trimStr);
  setIfPresent(payload, formData, 'color', (v) => (v || '#9494AA').trim());
  setIfPresent(payload, formData, 'voice', trimStr);
  setIfPresent(payload, formData, 'style_guide', trimStr);
  setIfPresent(payload, formData, 'messaging', parseMessaging);
  setIfPresent(payload, formData, 'category', trimStr);
  setIfPresent(payload, formData, 'mission', trimStr);
  setIfPresent(payload, formData, 'positioning', trimStr);
  setIfPresent(payload, formData, 'audience', trimStr);
  setIfPresent(payload, formData, 'personality', parseMessaging);

  // ---- brand_book (JSONB) ----
  // Begin from the previous brand_book, then overlay only submitted keys.
  const brand_book = { ...prevBook };

  // Text fields
  const bookStrFields = [
    'caption_structure', 'emoji_rule', 'icon_url', 'brand_story',
    'competitive_landscape', 'customer_personas', 'logo_rules', 'typography',
    'photo_direction', 'video_direction', 'packaging', 'social_rules',
    'community_guidelines', 'dos_donts', 'vocab_dictionary', 'faqs',
    'seasonal_calendar', 'campaign_history', 'legal_compliance', 'ai_prompts',
  ];
  for (const f of bookStrFields) setIfPresent(brand_book, formData, f, trimStr);

  // List fields (newline/comma separated)
  const bookListFields = [
    'ctas', 'hashtags_primary', 'hashtags_secondary', 'hashtags_banned',
    'vocab_preferred', 'vocab_banned', 'content_pillars',
  ];
  for (const f of bookListFields) setIfPresent(brand_book, formData, f, parseMessaging);

  // JSON fields (attachments / palette / gallery). These come from hidden
  // inputs that are always present, but we still guard with setIfPresent so
  // a missing field never blanks stored data.
  const jsonObjFields = ['palette', 'photo_images'];
  for (const f of jsonObjFields) {
    setIfPresent(brand_book, formData, f, (v) => safeJson(v, prevBook[f] ?? {}));
  }
  const jsonArrFields = [
    'gallery', 'logo_images', 'font_files', 'cover_templates',
    'video_refs', 'packaging_images',
  ];
  for (const f of jsonArrFields) {
    setIfPresent(brand_book, formData, f, (v) => safeJson(v, prevBook[f] ?? []));
  }
  // style_guide_pdf is a single object-or-null
  setIfPresent(brand_book, formData, 'style_guide_pdf', (v) =>
    safeJson(v, prevBook.style_guide_pdf ?? null)
  );

  payload.brand_book = brand_book;

  let error;
  if (id) {
    ({ error } = await supabase.from('brands').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('brands').insert(payload));
  }

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function archiveBrand(prevState, formData) {
  const id = formData.get('id');
  if (!id) return { error: 'Missing brand id.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('brands')
    .update({ archived: true })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteBrand(prevState, formData) {
  const id = formData.get('id');
  if (!id) return { error: 'Missing brand id.' };

  const supabase = await createClient();
  // Permanent delete. Dependent rows (content, assets, members) cascade
  // via the schema's ON DELETE CASCADE foreign keys.
  const { error } = await supabase.from('brands').delete().eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}
