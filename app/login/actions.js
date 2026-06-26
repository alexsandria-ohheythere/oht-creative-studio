'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';

// Email + password sign-in (the Command Center method).
export async function signIn(prevState, formData) {
  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) {
    return { error: 'Enter your email and password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}
