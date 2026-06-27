'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_SECTIONS } from '../lib/nav';
import { brandColor, sortBrands } from '../lib/brands';

export default function Sidebar({ brands, currentBrand }) {
  const pathname = usePathname();
  const router = useRouter();
  const ordered = sortBrands(brands || []);
  const activeColor = brandColor(currentBrand?.slug);

  // Which section in the path right now, e.g. /matcha/content/ideas -> 'content'
  const parts = (pathname || '').split('/').filter(Boolean); // [slug, section, sub?]
  const activeSection = parts[1];
  const activeSub = parts[2];

  return (
    <aside className="cs-sidebar">
      {/* Brand switcher */}
      <div className="cs-brandswitch">
        <label className="cs-brandswitch__label">Brand</label>
        <select
          className="cs-brandswitch__select"
          value={currentBrand?.slug || ''}
          onChange={(e) => router.push(`/${e.target.value}/brain`)}
          style={{ borderColor: activeColor }}
        >
          {ordered.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sections */}
      <nav className="cs-nav">
        {NAV_SECTIONS.map((section) => (
          <NavSection
            key={section.key}
            section={section}
            brandSlug={currentBrand?.slug}
            activeSection={activeSection}
            activeSub={activeSub}
          />
        ))}
      </nav>

      <div className="cs-sidebar__foot">
        OH HEY THERE Corp. · Creative OS
      </div>
    </aside>
  );
}

function NavSection({ section, brandSlug, activeSection, activeSub }) {
  const isActive = activeSection === section.key;
  const [open, setOpen] = useState(isActive);
  const base = `/${brandSlug}/${section.key}`;
  const hasChildren = !!section.children?.length;

  return (
    <div className={`cs-navsec ${section.accent ? 'cs-navsec--accent' : ''}`}>
      <div className="cs-navsec__row">
        <Link
          href={base}
          className={`cs-navsec__link ${isActive ? 'is-active' : ''}`}
        >
          <span
            className="cs-navsec__dot"
            style={{ background: section.color }}
          />
          <span className="cs-navsec__label">{section.label}</span>
        </Link>
        {hasChildren && (
          <button
            className="cs-navsec__toggle"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '−' : '+'}
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="cs-navsec__children">
          {section.children.map((child) => {
            const childActive = isActive && activeSub === child.key;
            return (
              <Link
                key={child.key}
                href={`${base}/${child.key}`}
                className={`cs-navchild ${childActive ? 'is-active' : ''} ${
                  child.soon ? 'is-soon' : ''
                }`}
              >
                {child.label}
                {child.soon && <span className="cs-soon">soon</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
