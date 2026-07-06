'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

// public.brand_templates: id, brand_id, name, kind, body, created_at
// RLS: command-only for both read and write (matches the Theme nav item,
// which is command-scoped in config/app.json).

export async function saveTemplate(prevState, formData) {
  const id = formData.get('id'); // present when editing
  const brand_id = formData.get('brand_id');
  const name = (formData.get('name') || '').trim();
  const kind = (formData.get('kind') || '').trim();
  const body = (formData.get('body') || '').trim();

  if (!brand_id) return { error: 'Pick a brand first.' };
  if (!name) return { error: 'Template name is required.' };

  const supabase = await createClient();
  const payload = { brand_id, name, kind: kind || null, body: body || null };

  let error;
  if (id) {
    ({ error } = await supabase.from('brand_templates').update(payload).eq('id', id));
  } else {
    ({ error } = await supabase.from('brand_templates').insert(payload));
  }

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteTemplate(prevState, formData) {
  const id = formData.get('id');
  if (!id) return { error: 'Missing template id.' };

  const supabase = await createClient();
  const { error } = await supabase.from('brand_templates').delete().eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  return { ok: true, deleted: true };
}
