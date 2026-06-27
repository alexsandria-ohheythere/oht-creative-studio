import { redirect, notFound } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import Sidebar from '../../components/Sidebar';

// Wraps every /[brand]/... page.
// 1. Requires a logged-in user (middleware already guards, this is belt-and-suspenders).
// 2. Loads the brands this user can see — RLS returns only their memberships.
// 3. 404s if the URL's brand isn't one they have access to.
export default async function BrandLayout({ children, params }) {
  const { brand } = await params; // the [brand] slug from the URL
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS scopes this to brands the user is a member of.
  const { data: brands, error } = await supabase
    .from('brands')
    .select('id, slug, name');

  if (error) {
    // Surface a real error rather than a silent empty sidebar.
    throw new Error(`Could not load brands: ${error.message}`);
  }

  const currentBrand = (brands || []).find((b) => b.slug === brand);
  // Slug doesn't exist OR user isn't a member of it -> not found.
  if (!currentBrand) notFound();

  return (
    <div className="cs-shell">
      <Sidebar brands={brands} currentBrand={currentBrand} />
      <main className="cs-main">{children}</main>
    </div>
  );
}
