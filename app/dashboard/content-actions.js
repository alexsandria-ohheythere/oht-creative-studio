'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

// Content pipeline: Content Bucket / Ideas -> Production -> (assets, later).
// Briefs has been retired — ideas carry full brief-level detail themselves
// (channel, format, hook, caption, hashtags, mandatories, dates), so an idea
// promotes straight into a content_item.
// Real schema (live DB), do not assume columns beyond these:
//   ideas:         id, brand_id, campaign_id, title, notes, status, ready,
//                  pillar, channel, format, hook, caption, hashtags,
//                  mandatories, publish_date, production_due, edit_due,
//                  carousel_slides (jsonb array, always normalized to 5
//                  string entries; only shown/edited in the UI when format
//                  is a Carousel variant)
//                  status in ('new','approved','archived')
//                  ready: false = row lives in the Content Bucket table only,
//                         true  = also shown as a card in the Ideas module
//   content_items: id, brand_id, idea_id, brief_id(legacy, unused), campaign_id,
//                  title, body, status
//                  status in ('command_review','in_production','review','approved')
//
// Every write returns error.message on failure AND selects the row back so a
// silent RLS zero-row write (no policy => success with 0 rows) is detected.

const IDEA_STATUS = ['new', 'approved', 'archived'];
const CONTENT_STATUS = ['command_review', 'in_production', 'review', 'approved'];

function nz(v) {
  const s = (v || '').toString().trim();
  return s ? s : null;
}

async function writeBack(query) {
  // query is a PostgREST builder ending in .select(); returns {data,error}.
  const { data, error } = await query.select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'Saved nothing — you may not have permission for this action (check RLS).' };
  }
  return { ok: true, row: data[0] };
}

// ---------------------------------------------------------------- IDEAS
function isoDate(v) {
  const s = (v || '').toString().trim();
  return s ? s : null;
}
// Returns YYYY-MM-DD that is `days` before the given YYYY-MM-DD, or null.
function dueBefore(publish, days) {
  if (!publish) return null;
  const d = new Date(publish + 'T00:00:00Z');
  if (isNaN(d)) return null;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function saveIdea(prevState, formData) {
  const id = nz(formData.get('id'));
  const title = nz(formData.get('title'));
  const brand_id = nz(formData.get('brand_id'));
  const campaign_id = nz(formData.get('campaign_id'));
  const pillar = nz(formData.get('pillar'));
  const channel = nz(formData.get('channel'));
  const format = nz(formData.get('format'));
  const notes = nz(formData.get('notes'));
  const hook = nz(formData.get('hook'));
  const caption = nz(formData.get('caption'));
  const hashtags = nz(formData.get('hashtags'));
  const mandatories = nz(formData.get('mandatories'));
  const publish_date = isoDate(formData.get('publish_date'));
  const production_due = dueBefore(publish_date, 5);
  const edit_due = dueBefore(publish_date, 3);
  let status = nz(formData.get('status')) || 'new';
  if (!IDEA_STATUS.includes(status)) status = 'new';
  // ready: false = still a Content Bucket row, true = also a card in Ideas.
  const ready = formData.get('ready') === 'true';

  // Carousel Slides: 5 fixed text slots, only meaningful when format is a
  // Carousel variant. Arrives as a JSON array of up to 5 strings; always
  // normalized to exactly 5 entries (padded/truncated) so the UI can index
  // safely regardless of format.
  let carousel_slides = [];
  try {
    const raw = formData.get('carousel_slides');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        carousel_slides = Array.from({ length: 5 }, (_, i) => nz(parsed[i]) || '');
      }
    }
  } catch {
    carousel_slides = [];
  }

  if (!title) return { error: 'Idea needs a title.' };
  if (!brand_id) return { error: 'Pick a brand.' };

  const supabase = await createClient();
  const payload = {
    title, brand_id, campaign_id, pillar, channel, format,
    notes, hook, caption, hashtags, mandatories,
    publish_date, production_due, edit_due, status, ready,
    carousel_slides,
  };
  const q = id
    ? supabase.from('ideas').update(payload).eq('id', id)
    : supabase.from('ideas').insert(payload);

  const res = await writeBack(q);
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

// One-click toggle used from the Content Bucket table — flips an idea's
// `ready` flag without opening the full form. true = pop it into Ideas.
export async function setIdeaReady(prevState, formData) {
  const id = nz(formData.get('id'));
  const ready = formData.get('ready') === 'true';
  if (!id) return { error: 'Missing idea id.' };
  const supabase = await createClient();
  const res = await writeBack(
    supabase.from('ideas').update({ ready }).eq('id', id)
  );
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

// Duplicate a Content Bucket row: copies every editable field (including
// carousel slides) onto a brand-new row as a fast starting point for a
// variant. Always lands un-ready (draft) even if the original was already
// flipped to Ready, so a duplicate never jumps straight into the Ideas
// module unannounced — Alex has to flip it on purpose.
export async function duplicateIdea(prevState, formData) {
  const id = nz(formData.get('id'));
  if (!id) return { error: 'Missing idea id.' };

  const supabase = await createClient();
  const { data: original, error: fetchError } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError) return { error: fetchError.message };
  if (!original) return { error: 'Could not find that row to duplicate.' };

  const payload = {
    brand_id: original.brand_id,
    campaign_id: original.campaign_id,
    title: `${original.title} (Copy)`,
    notes: original.notes,
    status: 'new',
    pillar: original.pillar,
    channel: original.channel,
    format: original.format,
    hook: original.hook,
    caption: original.caption,
    hashtags: original.hashtags,
    mandatories: original.mandatories,
    publish_date: original.publish_date,
    production_due: original.production_due,
    edit_due: original.edit_due,
    ready: false,
    carousel_slides: Array.isArray(original.carousel_slides) ? original.carousel_slides : [],
  };

  const res = await writeBack(supabase.from('ideas').insert(payload));
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

export async function deleteIdea(prevState, formData) {
  const id = nz(formData.get('id'));
  if (!id) return { error: 'Missing idea id.' };
  const supabase = await createClient();
  const { error } = await supabase.from('ideas').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}

// Promote an idea straight into production: create a content_item carrying
// the idea's title, linked back via idea_id. Used both by "Promote to
// Production" on an Idea card, and by dropping a Command Review idea-card
// onto another column in the Production board (status = drop target).
export async function promoteIdeaToProduction(prevState, formData) {
  const idea_id = nz(formData.get('idea_id'));
  const brand_id = nz(formData.get('brand_id'));
  const campaign_id = nz(formData.get('campaign_id'));
  const title = nz(formData.get('title')) || 'Untitled';
  let status = nz(formData.get('status')) || 'command_review';
  if (!CONTENT_STATUS.includes(status)) status = 'command_review';
  if (!idea_id || !brand_id) return { error: 'Missing idea or brand.' };

  const supabase = await createClient();

  // Ready flag just means "visible as an Ideas card" — promoting to
  // production should always leave it ready so it stays visible there too.
  await supabase.from('ideas').update({ ready: true }).eq('id', idea_id);

  const res = await writeBack(
    supabase.from('content_items').insert({
      idea_id, brand_id, campaign_id, title, body: '', status,
    })
  );
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

// --------------------------------------------------------------- CONTENT
export async function saveContent(prevState, formData) {
  const id = nz(formData.get('id'));
  const brand_id = nz(formData.get('brand_id'));
  const idea_id = nz(formData.get('idea_id'));
  const campaign_id = nz(formData.get('campaign_id'));
  const title = nz(formData.get('title'));
  const body = (formData.get('body') || '').toString().trim();
  let status = nz(formData.get('status')) || 'command_review';
  if (!CONTENT_STATUS.includes(status)) status = 'command_review';

  if (!title) return { error: 'Content needs a title.' };
  if (!brand_id) return { error: 'Pick a brand.' };

  const supabase = await createClient();
  const payload = { brand_id, idea_id, campaign_id, title, body, status };
  const q = id
    ? supabase.from('content_items').update(payload).eq('id', id)
    : supabase.from('content_items').insert(payload);

  const res = await writeBack(q);
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

// Move a content item between production stages.
export async function setContentStatus(prevState, formData) {
  const id = nz(formData.get('id'));
  let status = nz(formData.get('status'));
  if (!id || !CONTENT_STATUS.includes(status)) return { error: 'Bad status change.' };
  const supabase = await createClient();
  const res = await writeBack(
    supabase.from('content_items').update({ status }).eq('id', id)
  );
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

// Save the attachments list (Google Drive links) for a content item.
// Attachments arrive as a JSON string: [{ type:'link', url, name }, ...]
// Both command and brand-scoped freelancers can write (RLS decides), so a
// freelancer like Tali can attach files for submission on her own brand.
export async function setContentAttachments(prevState, formData) {
  const id = nz(formData.get('id'));
  if (!id) return { error: 'Missing content id.' };

  let attachments = [];
  try {
    const raw = formData.get('attachments');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        attachments = parsed
          .map((a) => ({
            type: 'link',
            url: (a?.url || '').toString().trim(),
            name: (a?.name || '').toString().trim(),
          }))
          .filter((a) => a.url);
      }
    }
  } catch {
    return { error: 'Could not read the attachments list.' };
  }

  const supabase = await createClient();
  const res = await writeBack(
    supabase.from('content_items').update({ attachments }).eq('id', id)
  );
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

export async function deleteContent(prevState, formData) {
  const id = nz(formData.get('id'));
  if (!id) return { error: 'Missing content id.' };
  const supabase = await createClient();
  const { error } = await supabase.from('content_items').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}
