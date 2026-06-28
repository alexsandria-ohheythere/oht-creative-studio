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

  // Load content items with the REAL columns that exist on the live table.
  // (The old select referenced owner_name/reach/etc. which don't exist.)
  const { data: content } = await supabase
    .from('content_items')
    .select('id, brand_id, brief_id, campaign_id, title, body, status, created_at')
    .order('created_at', { ascending: false });

  // Pipeline upstream: ideas and briefs.
  const { data: ideas } = await supabase
    .from('ideas')
    .select('id, brand_id, campaign_id, pillar, channel, format, title, notes, hook, caption, hashtags, mandatories, status, created_at')
    .order('created_at', { ascending: false });

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, brand_id, idea_id, channel, format, brief, hook, caption, hashtags, mandatories, references, attachments, status, created_at')
    .order('created_at', { ascending: false });

  // Load campaigns. RLS scopes these (command sees all, freelancers see one).
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, brand_id, name, goal, status, starts_on, ends_on, pillars')
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
      ideas={ideas || []}
      briefs={briefs || []}
      brands={brands || []}
      campaigns={campaigns || []}
    />
  );
}
