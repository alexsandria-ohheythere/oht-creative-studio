// Single source of truth for brand presentation (colors, order).
// The brands themselves live in Supabase; this just maps slug -> visual identity.
// Editable here without touching components — matches the "config in one place" preference.

export const BRAND_COLORS = {
  matcha: '#64BC46',      // green
  domo: '#EE268C',        // hot pink
  'more-ahead': '#AED8FF',// sky blue
  goods: '#DDEE26',       // lime
};

// Fallback color if a brand slug has no mapping yet.
export const DEFAULT_BRAND_COLOR = '#FFAEF1'; // lavender

export function brandColor(slug) {
  return BRAND_COLORS[slug] || DEFAULT_BRAND_COLOR;
}

// Display order for the brand switcher (slugs not listed fall to the end).
export const BRAND_ORDER = ['matcha', 'domo', 'more-ahead', 'goods'];

export function sortBrands(brands) {
  return [...brands].sort((a, b) => {
    const ia = BRAND_ORDER.indexOf(a.slug);
    const ib = BRAND_ORDER.indexOf(b.slug);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}
