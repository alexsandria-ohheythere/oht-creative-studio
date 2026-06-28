'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

// Writes go through the server with the user's session.
// RLS on public.campaigns enforces who can write.
//
// Real table shape:
//   id, brand_id (uuid -> brands.id), name, goal,
//   status ('planning'|'active'|'done'), starts_on, ends_on, created_at

const ALLOWED_STATUS = ['planning', 'active', 'done'];

function cleanDate(raw) {
  const v = (raw || '').trim();
  return v ? v : null;
}

export async function saveCampaign(prevState, formData) {
  const id = formData.get('id'); // present when editing
  const name = (formData.get('name') || '').trim();
  const brand_id = (formData.get('brand_id') || '').trim();
  const goal = (formData.get('goal') || '').trim();
  let status = (formData.get('status') || 'planning').trim();
  const starts_on = cleanDate(formData.get('starts_on'));
  const ends_on = cleanDate(formData.get('ends_on'));

  if (!name) return { error: 'Campaign name is required.' };
  if (!brand_id) return { error: 'Pick a brand for this campaign.' };
  if (!ALLOWED_STATUS.includes(status)) status = 'planning';

  const supabase = await createClient();
  const payload = { name, brand_id, goal, status, starts_on, ends_on };

  let error;
  if (id) {
    ({ error } = await supabase.from('campaigns').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('campaigns').insert(payload));
  }

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteCampaign(prevState, formData) {
  const id = formData.get('id');
  if (!id) return { error: 'Missing campaign id.' };

  const supabase = await createClient();
  // content_items.campaign_id is ON DELETE SET NULL, so deleting a campaign
  // only un-links its content — it never deletes the content itself.
  const { error } = await supabase.from('campaigns').delete().eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}
