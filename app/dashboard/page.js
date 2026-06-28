import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import StudioShell from '../../components/StudioShell';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Load this user's profile (role + brand scope).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, brand_scope, title')
    .eq('id', user.id)
    .single();

  // Load content. RLS does the real scoping: command sees all,
  // freelancers only get their brand's rows. No client-side filtering needed.
  const { data: content } = await supabase
    .from('content_items')
    .select(
      'id, title, brand, status, owner_name, due_date, channel, publish_at, reach, engagement, ctr, conversions, revenue, campaign_id'
    )
    .order('created_at', { ascending: true });

  // Load campaigns. RLS scopes these (command sees all, freelancers see one).
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, brand_id, name, goal, status, starts_on, ends_on')
    .order('created_at', { ascending: false });

  // Load brands. RLS scopes these too (command sees all, freelancers see one).
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, tagline, color, voice, style_guide, messaging, archived, mission, positioning, audience, personality, category, status, brand_book')
    .eq('archived', false)
    .order('created_at', { ascending: true });

  const safeProfile = profile || {
    full_name: user.email,
    role: 'freelance',
    brand_scope: null,
    title: 'Member',
  };

  return (
    <StudioShell
      profile={safeProfile}
      email={user.email}
      content={content || []}
      brands={brands || []}
      campaigns={campaigns || []}
    />
  );
}
