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
    .select('id, brand_id, brief_id, campaign_id, title, body, status, attachments, drive_folder_id, drive_folder_url, created_at')
    .order('created_at', { ascending: false });

  // Pipeline upstream: ideas and briefs.
  const { data: ideas } = await supabase
    .from('ideas')
    .select('id, brand_id, campaign_id, pillar, channel, format, title, notes, hook, caption, hashtags, mandatories, publish_date, production_due, edit_due, status, created_at')
    .order('created_at', { ascending: false });

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, brand_id, idea_id, channel, format, brief, hook, caption, hashtags, mandatories, references, attachments, publish_date, production_due, edit_due, status, created_at')
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

  // Load assets for the Asset Library. RLS scopes these (command sees all,
  // freelancers see only their scoped brand). Real columns only.
  const { data: assets } = await supabase
    .from('assets')
    .select('id, brand_id, content_id, storage_path, kind, created_at')
    .order('created_at', { ascending: false });

  const safeProfile = profile || {
    full_name: user.email,
    role: 'freelance',
    brand_scope: null,
    title: 'Member',
  };

  // Is the shared Google Drive connected? (RLS: only command can read the row,
  // so freelancers will see false — fine; they upload via the shared folder link
  // which lives on each card.)
  const { data: gtok } = await supabase
    .from('google_tokens').select('account').eq('account', 'ohheythere.group').maybeSingle();
  const googleConnected = !!gtok;

  return (
    <StudioShell
      profile={safeProfile}
      email={user.email}
      content={content || []}
      ideas={ideas || []}
      briefs={briefs || []}
      brands={brands || []}
      campaigns={campaigns || []}
      assets={assets || []}
      googleConnected={googleConnected}
    />
  );
}
