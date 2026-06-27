import { createClient } from '../../../lib/supabase-server';
import { notFound } from 'next/navigation';

// Brand Brain — first real section. For now a stub that confirms routing +
// data scoping work: it reads the brand_brain row for THIS brand via RLS.
export default async function BrainPage({ params }) {
  const { brand } = await params;
  const supabase = await createClient();

  const { data: brandRow } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('slug', brand)
    .single();

  if (!brandRow) notFound();

  const { data: brain } = await supabase
    .from('brand_brain')
    .select('positioning, voice, identity, audience, updated_at')
    .eq('brand_id', brandRow.id)
    .maybeSingle();

  return (
    <div className="cs-page">
      <header className="cs-page__head">
        <p className="cs-eyebrow">Brand Brain</p>
        <h1 className="cs-h1">{brandRow.name}</h1>
        <p className="cs-sub">Everything about the brand — voice, identity, audience, positioning.</p>
      </header>

      {brain ? (
        <section className="cs-card">
          <h2>Positioning</h2>
          <p>{brain.positioning || <em>Not set yet.</em>}</p>
          <p className="cs-meta">
            Last updated:{' '}
            {brain.updated_at
              ? new Date(brain.updated_at).toLocaleDateString()
              : '—'}
          </p>
        </section>
      ) : (
        <section className="cs-card cs-card--empty">
          <h2>No Brand Brain yet</h2>
          <p>This brand doesn’t have a Brand Brain record. Create one to give the AI Strategist something to learn from.</p>
        </section>
      )}
    </div>
  );
}
