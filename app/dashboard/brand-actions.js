'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';

// All writes go through the server with the user's session.
// RLS ("command writes brands") enforces that only command users can write.

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

  if (!name) {
    return { error: 'Brand name is required.' };
  }

  const supabase = await createClient();
  const payload = { name, tagline, color, voice, style_guide, messaging };

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
