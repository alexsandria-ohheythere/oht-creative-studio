'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

// Content pipeline: ideas -> briefs -> content_items -> (assets, later).
// Real schema (live DB), do not assume columns beyond these:
//   ideas:         id, brand_id, campaign_id, title, notes, status
//                  status in ('new','approved','archived')
//   briefs:        id, brand_id, idea_id, channel, brief, status
//                  status in ('draft','approved','archived')
//   content_items: id, brand_id, brief_id, campaign_id, title, body, status
//                  status in ('in_production','review','approved')
//
// Every write returns error.message on failure AND selects the row back so a
// silent RLS zero-row write (no policy => success with 0 rows) is detected.

const IDEA_STATUS = ['new', 'approved', 'archived'];
const BRIEF_STATUS = ['draft', 'approved', 'archived'];
const CONTENT_STATUS = ['in_production', 'review', 'approved'];

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
export async function saveIdea(prevState, formData) {
  const id = nz(formData.get('id'));
  const title = nz(formData.get('title'));
  const brand_id = nz(formData.get('brand_id'));
  const campaign_id = nz(formData.get('campaign_id'));
  const notes = nz(formData.get('notes'));
  let status = nz(formData.get('status')) || 'new';
  if (!IDEA_STATUS.includes(status)) status = 'new';

  if (!title) return { error: 'Idea needs a title.' };
  if (!brand_id) return { error: 'Pick a brand.' };

  const supabase = await createClient();
  const payload = { title, brand_id, campaign_id, notes, status };
  const q = id
    ? supabase.from('ideas').update(payload).eq('id', id)
    : supabase.from('ideas').insert(payload);

  const res = await writeBack(q);
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

// Promote an approved/any idea into a new draft brief carrying idea_id.
export async function promoteIdeaToBrief(prevState, formData) {
  const idea_id = nz(formData.get('idea_id'));
  const brand_id = nz(formData.get('brand_id'));
  const channel = nz(formData.get('channel'));
  if (!idea_id || !brand_id) return { error: 'Missing idea or brand.' };

  const supabase = await createClient();
  // Mark the idea approved, then create the brief from it.
  await supabase.from('ideas').update({ status: 'approved' }).eq('id', idea_id);
  const res = await writeBack(
    supabase.from('briefs').insert({
      idea_id, brand_id, channel, brief: '', status: 'draft',
    })
  );
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

// --------------------------------------------------------------- BRIEFS
export async function saveBrief(prevState, formData) {
  const id = nz(formData.get('id'));
  const brand_id = nz(formData.get('brand_id'));
  const idea_id = nz(formData.get('idea_id'));
  const channel = nz(formData.get('channel'));
  const brief = (formData.get('brief') || '').toString().trim();
  let status = nz(formData.get('status')) || 'draft';
  if (!BRIEF_STATUS.includes(status)) status = 'draft';

  if (!brand_id) return { error: 'Pick a brand.' };

  const supabase = await createClient();
  const payload = { brand_id, idea_id, channel, brief, status };
  const q = id
    ? supabase.from('briefs').update(payload).eq('id', id)
    : supabase.from('briefs').insert(payload);

  const res = await writeBack(q);
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

export async function deleteBrief(prevState, formData) {
  const id = nz(formData.get('id'));
  if (!id) return { error: 'Missing brief id.' };
  const supabase = await createClient();
  const { error } = await supabase.from('briefs').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}

// Send an approved/any brief into production: create content_items with brief_id.
export async function startProduction(prevState, formData) {
  const brief_id = nz(formData.get('brief_id'));
  const brand_id = nz(formData.get('brand_id'));
  const title = nz(formData.get('title')) || 'Untitled';
  if (!brief_id || !brand_id) return { error: 'Missing brief or brand.' };

  const supabase = await createClient();
  await supabase.from('briefs').update({ status: 'approved' }).eq('id', brief_id);
  const res = await writeBack(
    supabase.from('content_items').insert({
      brief_id, brand_id, title, body: '', status: 'in_production',
    })
  );
  if (res.ok) revalidatePath('/dashboard');
  return res;
}

// --------------------------------------------------------------- CONTENT
export async function saveContent(prevState, formData) {
  const id = nz(formData.get('id'));
  const brand_id = nz(formData.get('brand_id'));
  const brief_id = nz(formData.get('brief_id'));
  const campaign_id = nz(formData.get('campaign_id'));
  const title = nz(formData.get('title'));
  const body = (formData.get('body') || '').toString().trim();
  let status = nz(formData.get('status')) || 'in_production';
  if (!CONTENT_STATUS.includes(status)) status = 'in_production';

  if (!title) return { error: 'Content needs a title.' };
  if (!brand_id) return { error: 'Pick a brand.' };

  const supabase = await createClient();
  const payload = { brand_id, brief_id, campaign_id, title, body, status };
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

export async function deleteContent(prevState, formData) {
  const id = nz(formData.get('id'));
  if (!id) return { error: 'Missing content id.' };
  const supabase = await createClient();
  const { error } = await supabase.from('content_items').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}
