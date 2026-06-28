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

export async function saveBrand(prevState, formData) {
  const id = formData.get('id'); // present when editing
  const name = (formData.get('name') || '').trim();
  const tagline = (formData.get('tagline') || '').trim();
  const color = (formData.get('color') || '#9494AA').trim();
  const voice = (formData.get('voice') || '').trim();
  const style_guide = (formData.get('style_guide') || '').trim();
  const messaging = parseMessaging(formData.get('messaging'));

  // Strategy fields (AI-context core)
  const category = (formData.get('category') || '').trim();
  const mission = (formData.get('mission') || '').trim();
  const positioning = (formData.get('positioning') || '').trim();
  const audience = (formData.get('audience') || '').trim();
  const personality = parseMessaging(formData.get('personality'));

  // Caption Playbook — machine-readable structure the Line-Up module reads.
  // Stored in the brand_book JSONB column so we never need a schema change
  // to add more playbook fields later.
  const brand_book = {
    caption_structure: (formData.get('caption_structure') || '').trim(),
    ctas: parseMessaging(formData.get('ctas')),
    hashtags_primary: parseMessaging(formData.get('hashtags_primary')),
    hashtags_secondary: parseMessaging(formData.get('hashtags_secondary')),
    hashtags_banned: parseMessaging(formData.get('hashtags_banned')),
    vocab_preferred: parseMessaging(formData.get('vocab_preferred')),
    vocab_banned: parseMessaging(formData.get('vocab_banned')),
    emoji_rule: (formData.get('emoji_rule') || '').trim(),
    content_pillars: parseMessaging(formData.get('content_pillars')),

    // Icon
    icon_url: (formData.get('icon_url') || '').trim(),
    // Identity (extended)
    brand_story: (formData.get('brand_story') || '').trim(),
    competitive_landscape: (formData.get('competitive_landscape') || '').trim(),
    customer_personas: (formData.get('customer_personas') || '').trim(),

    // Visual
    logo_rules: (formData.get('logo_rules') || '').trim(),
    typography: (formData.get('typography') || '').trim(),
    photo_direction: (formData.get('photo_direction') || '').trim(),
    video_direction: (formData.get('video_direction') || '').trim(),
    packaging: (formData.get('packaging') || '').trim(),

    // Visual attachments
    style_guide_pdf: safeJson(formData.get('style_guide_pdf'), null),
    logo_images: safeJson(formData.get('logo_images'), []),
    font_files: safeJson(formData.get('font_files'), []),
    cover_templates: safeJson(formData.get('cover_templates'), []),
    video_refs: safeJson(formData.get('video_refs'), []),
    photo_images: safeJson(formData.get('photo_images'), {}),
    packaging_images: safeJson(formData.get('packaging_images'), []),

    // Content
    social_rules: (formData.get('social_rules') || '').trim(),
    community_guidelines: (formData.get('community_guidelines') || '').trim(),
    dos_donts: (formData.get('dos_donts') || '').trim(),
    vocab_dictionary: (formData.get('vocab_dictionary') || '').trim(),
    faqs: (formData.get('faqs') || '').trim(),
    seasonal_calendar: (formData.get('seasonal_calendar') || '').trim(),
    campaign_history: (formData.get('campaign_history') || '').trim(),

    // Legal + AI
    legal_compliance: (formData.get('legal_compliance') || '').trim(),
    ai_prompts: (formData.get('ai_prompts') || '').trim(),

    // Palette (object of slot→hex) and Gallery (array of {url, caption})
    palette: safeJson(formData.get('palette'), {}),
    gallery: safeJson(formData.get('gallery'), []),
  };

  if (!name) {
    return { error: 'Brand name is required.' };
  }

  const supabase = await createClient();
  const payload = {
    name, tagline, color, voice, style_guide, messaging,
    category, mission, positioning, audience, personality,
    brand_book,
  };

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
