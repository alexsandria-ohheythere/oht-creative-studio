import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import StudioShell from '../../components/StudioShell';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Load this user's profile (role + brand scope + delete permission).
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, brand_scope, title, can_delete')
    .eq('id', user.id)
    .single();

  // All of the reads below are independent of one another (none depends on
  // another's result), so we fire them all at once with Promise.all instead
  // of awaiting each in turn. Sequential awaits here were the main reason
  // Save/Edit felt slow: every write calls revalidatePath('/dashboard'),
  // which reruns this whole function, and 9 queries run back-to-back could
  // add up to several seconds of pure waiting even though each individual
  // query is fast. Running them concurrently collapses that to the time of
  // the single slowest query.
  const [
    { data: content },
    { data: ideas },
    { data: campaigns },
    { data: brands },
    { data: assets },
    { data: mcThemes },
    { data: mcItems },
    { data: mcAssets },
    { data: gtok },
  ] = await Promise.all([
    // Content items with the REAL columns that exist on the live table.
    // (The old select referenced owner_name/reach/etc. which don't exist.)
    supabase
      .from('content_items')
      .select('id, brand_id, idea_id, brief_id, campaign_id, title, body, status, attachments, drive_folder_id, drive_folder_url, created_at')
      .order('created_at', { ascending: false }),

    // Pipeline upstream: ideas (Content Bucket rows + Ideas cards — same
    // table, split by the `ready` flag). Briefs has been retired.
    supabase
      .from('ideas')
      .select('id, brand_id, campaign_id, pillar, channel, format, title, notes, hook, caption, hashtags, mandatories, publish_date, production_due, edit_due, status, ready, carousel_slides, created_at')
      .order('created_at', { ascending: false }),

    // Campaigns. RLS scopes these (command sees all, freelancers see one).
    supabase
      .from('campaigns')
      .select('id, brand_id, name, goal, status, starts_on, ends_on, pillars')
      .order('created_at', { ascending: false }),

    // Brands. RLS scopes these too (command sees all, freelancers see one).
    supabase
      .from('brands')
      .select('id, name, tagline, color, voice, style_guide, messaging, archived, mission, positioning, audience, personality, category, status, brand_book')
      .eq('archived', false)
      .order('created_at', { ascending: true }),

    // Assets for the Asset Library. RLS scopes these (command sees all,
    // freelancers see only their scoped brand). Real columns only.
    supabase
      .from('assets')
      .select('id, brand_id, content_id, storage_path, kind, created_at')
      .order('created_at', { ascending: false }),

    // Marketing Collaterals data — independent from the social pipeline.
    // Theme (mc_themes) works like Campaigns; Line Up + Assembly are both
    // views over mc_items; Assets aggregates mc_assets + mc_items links.
    supabase
      .from('mc_themes')
      .select('id, brand_id, name, goal, status, starts_on, ends_on, pillars, created_at')
      .order('created_at', { ascending: false }),

    supabase
      .from('mc_items')
      .select('id, brand_id, theme_id, pillar, kind, title, notes, status, due_date, attachments, created_at')
      .order('created_at', { ascending: false }),

    supabase
      .from('mc_assets')
      .select('id, brand_id, item_id, storage_path, kind, created_at')
      .order('created_at', { ascending: false }),

    // Is the shared Google Drive connected? (RLS: only command can read the
    // row, so freelancers will see false — fine; they upload via the shared
    // folder link which lives on each card.)
    supabase
      .from('google_tokens').select('account').eq('account', 'ohheythere.group').maybeSingle(),
  ]);

  const safeProfile = profile || {
    full_name: user.email,
    role: 'freelance',
    brand_scope: null,
    title: 'Member',
    can_delete: true,
  };

  const googleConnected = !!gtok;

  return (
    <StudioShell
      profile={safeProfile}
      email={user.email}
      content={content || []}
      ideas={ideas || []}
      brands={brands || []}
      campaigns={campaigns || []}
      assets={assets || []}
      mcThemes={mcThemes || []}
      mcItems={mcItems || []}
      mcAssets={mcAssets || []}
      googleConnected={googleConnected}
    />
  );
}
