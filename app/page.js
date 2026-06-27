import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../lib/supabase-server';
import { sortBrands, brandColor } from '../lib/brands';

// Landing after login. Resolves where to go:
//  - no user        -> middleware already sent them to /login
//  - 1 brand        -> jump straight into it
//  - several brands -> show a chooser
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: brands } = await supabase.from('brands').select('id, slug, name');
  const list = sortBrands(brands || []);

  if (list.length === 0) {
    return (
      <div className="cs-picker">
        <h1 className="cs-h1">No brands yet</h1>
        <p className="cs-sub">Your account isn’t a member of any brand. Ask an owner to add you.</p>
      </div>
    );
  }

  if (list.length === 1) {
    redirect(`/${list[0].slug}/brain`);
  }

  return (
    <div className="cs-picker">
      <p className="cs-eyebrow">OH HEY THERE Corp. · Creative OS</p>
      <h1 className="cs-h1">Choose a brand</h1>
      <div className="cs-picker__grid">
        {list.map((b) => (
          <Link key={b.slug} href={`/${b.slug}/brain`} className="cs-picker__card"
            style={{ borderTopColor: brandColor(b.slug) }}>
            <span className="cs-picker__name">{b.name}</span>
            <span className="cs-picker__go">Open →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
