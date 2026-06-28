'use client';

import { useState, useEffect, useActionState } from 'react';
import appConfig from '../config/app.json';
import { saveBrand, archiveBrand, deleteBrand } from '../app/dashboard/brand-actions';
import { createClient as createBrowserClient } from '../lib/supabase-browser';

// Access model:
//  - role 'command'   → full access (Alex, CJ)
//  - role 'freelance' → scoped to brand_scope (Tali)
// Nav, statuses, and brand colors are editable in config/app.json
const NAV = appConfig.nav;
const STATUSES = appConfig.statuses;
const BRAND_COLOR = appConfig.brandColors;

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function StudioShell({ profile, email, content, brands = [] }) {
  const role = profile.role === 'command' ? 'command' : 'freelance';
  const visibleNav = NAV.filter((n) => n.roles.includes(role));
  const [active, setActive] = useState('dash');
  const [drawer, setDrawer] = useState(false);
  const [openGroups, setOpenGroups] = useState({}); // expandable sub-nav

  const sections = [...new Set(visibleNav.map((n) => n.section))];
  const isCommand = role === 'command';

  const brandColor = (name) => {
    const b = brands.find((x) => x.name === name);
    return (b && b.color) || BRAND_COLOR[name] || '#9494AA';
  };

  const byStatus = (s) => content.filter((c) => c.status === s);
  const pendingCount = content.filter((c) => ['submitted', 'changes'].includes(c.status)).length;

  function go(id) {
    setActive(id);
    setDrawer(false);
  }
  function toggleGroup(id, e) {
    e.stopPropagation();
    setOpenGroups((g) => ({ ...g, [id]: !g[id] }));
  }

  // Resolve which panel renders for the active id.
  // Parent ids and their sub-ids map to the same underlying panel,
  // with the sub-view passed through so the panel can focus a tab.
  const parentId = active.includes('.') ? active.split('.')[0] : active;
  const subView = active.includes('.') ? active.split('.')[1] : null;

  const activeLabel = (() => {
    for (const n of NAV) {
      if (n.id === active) return n.label;
      const child = (n.children || []).find((c) => c.id === active);
      if (child) return `${n.label} · ${child.label}`;
    }
    return 'Dashboard';
  })();

  return (
    <>
      <div className="mtop">
        <div className="mtop-burger" onClick={() => setDrawer((d) => !d)}>☰</div>
        <div className="mtop-name">{activeLabel}</div>
        <form action="/auth/signout" method="post">
          <button className="btn bg bsm" type="submit">Sign out</button>
        </form>
      </div>
      <div className={`sb-backdrop ${drawer ? 'show' : ''}`} onClick={() => setDrawer(false)} />

      <div className="shell">
        <aside className={`sb ${drawer ? 'open' : ''}`}>
          <div className="sb-logo">
            <div className="logo-mark">OH HEY THERE Corp.</div>
            <div className="logo-name">Creative Studio</div>
            <div className="logo-badge">Creative OS</div>
          </div>

          {sections.map((sec) => (
            <div className="sb-sec" key={sec}>
              <div className="sb-label">{sec}</div>
              {visibleNav.filter((n) => n.section === sec).map((n) => {
                const on = parentId === n.id;
                const hasKids = (n.children || []).length > 0;
                const expanded = openGroups[n.id] ?? on;
                return (
                  <div key={n.id}>
                    <div
                      className={`ni ${on ? 'on' : ''} ${n.flagship ? 'flagship' : ''}`}
                      style={on && n.accent ? { boxShadow: `inset 3px 0 0 ${n.accent}` } : {}}
                      onClick={() => go(hasKids ? (n.children[0].id) : n.id)}
                    >
                      <span className="ni-ic" style={n.accent ? { color: n.accent } : {}}>{n.icon}</span> {n.label}
                      {n.pill && <span className="ni-pill">{n.pill}</span>}
                      {n.id === 'camp' && <span className="ni-pill">4</span>}
                      {hasKids && (
                        <span className="ni-caret" onClick={(e) => toggleGroup(n.id, e)}>
                          {expanded ? '▾' : '▸'}
                        </span>
                      )}
                    </div>
                    {hasKids && expanded && (
                      <div className="ni-kids">
                        {n.children.map((c) => (
                          <div
                            key={c.id}
                            className={`ni-kid ${active === c.id ? 'on' : ''} ${c.soon ? 'soon' : ''}`}
                            onClick={() => go(c.id)}
                          >
                            {c.label}
                            {c.soon && <span className="kid-soon">soon</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <div className="sb-foot">
            <div className="bsw">
              <div className="bav" style={{ background: isCommand ? 'linear-gradient(135deg,var(--pink),var(--lav))' : 'linear-gradient(135deg,var(--blue),#78b8e8)' }}>
                {initials(profile.full_name || email)}
              </div>
              <div className="binfo">
                <div className="binfo-n">{profile.full_name || email}</div>
                <div className="binfo-r">
                  {isCommand ? 'Command · Full access' : `Freelance${profile.brand_scope ? ' · ' + profile.brand_scope : ''}`}
                </div>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button className="logout-btn" type="submit">Sign out</button>
            </form>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div className="tb-title">{activeLabel}</div>
            <div className="tb-search"><span>⌕</span><span>Search everything…</span><span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 3 }}>⌘K</span></div>
            <div className="tb-acts">
              {isCommand && <button className="btn bg">⊕ New Asset</button>}
              <button className="btn bl" onClick={() => go('strategist')}>✦ Ask the OS</button>
            </div>
          </div>

          <div className="content">
            {parentId === 'dash' && (
              <Dashboard profile={profile} content={content} isCommand={isCommand} pendingCount={pendingCount} />
            )}

            {parentId === 'brain' && (
              <BrandCenter brands={brands} isCommand={isCommand} content={content} />
            )}

            {parentId === 'camp' && (
              <Campaigns isCommand={isCommand} />
            )}

            {parentId === 'content' && (
              <ContentCenter content={content} brands={brands} brandColor={brandColor} subView={subView} />
            )}

            {parentId === 'publishing' && (
              <PublishingCenter content={content} brands={brands} brandColor={brandColor} subView={subView} />
            )}

            {parentId === 'insights' && (
              <AnalyticsCenter content={content} brands={brands} brandColor={brandColor} subView={subView} />
            )}

            {parentId === 'strategist' && (
              <Strategist content={content} brands={brands} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}

// =====================================================================
// CAMPAIGNS — groups content into initiatives (next build)
// =====================================================================
function Campaigns({ isCommand }) {
  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Campaigns</div>
          <div className="ps">Every marketing initiative, with its own goal and timeline</div>
        </div>
        {isCommand && <button className="btn bl">＋ New Campaign</button>}
      </div>
      <ComingSoon
        icon="◇"
        title="Campaign Manager"
        body="Group content into campaigns with goals, dates, and brands. Ties Content, Publishing, and Insights together so you can see how a whole initiative performed — not just single posts."
      />
    </>
  );
}

// =====================================================================
// AI STRATEGIST — reads everything, recommends what to make next
// =====================================================================
function Strategist({ content, brands }) {
  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">AI Strategist</div>
          <div className="ps">Learns from Brand Brain, Content, and Insights to recommend what to create next</div>
        </div>
      </div>
      <div className="intel" style={{ marginBottom: 18 }}>
        <div className="intel-ic">✦</div>
        <div style={{ flex: 1 }}>
          <div className="intel-lbl">How this works</div>
          <div className="intel-q">The Strategist reads your real data — it doesn&apos;t guess.</div>
          <div className="intel-s">Once Brand Brain, Content, and Insights have data flowing, it will combine voice + performance + audience to suggest your next moves per brand.</div>
        </div>
      </div>
      <ComingSoon
        icon="✦"
        title="Ask the OS"
        body={`Reads across ${brands.length} brands and ${content.length} content items. Recommendations unlock as your Insights data grows — built last on purpose, so it has something real to learn from.`}
      />
    </>
  );
}

// Reusable "next build" panel — styled, honest about state.
function ComingSoon({ icon, title, body }) {
  return (
    <div className="soon-card">
      <div className="soon-ic">{icon}</div>
      <div className="soon-t">{title}</div>
      <div className="soon-b">{body}</div>
      <div className="soon-tag">Coming in next build</div>
    </div>
  );
}

function Dashboard({ profile, content, isCommand, pendingCount }) {
  const first = (profile.full_name || 'there').split(' ')[0];
  const scheduled = content.filter((c) => c.status === 'scheduled').length;
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 26, fontWeight: 700 }}>
          Welcome back, {first} 👋
        </div>
        <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
          {isCommand
            ? `${content.length} items in the pipeline · ${pendingCount} awaiting review`
            : `${content.length} items for ${profile.brand_scope || 'your brand'} · scoped view`}
        </div>
      </div>

      {isCommand && (
        <div className="intel">
          <div className="intel-ic">✦</div>
          <div style={{ flex: 1 }}>
            <div className="intel-lbl">Creative Intelligence</div>
            <div className="intel-q">&ldquo;Based on your best-performing content, what should you create next?&rdquo;</div>
            <div className="intel-s">Carousel posts on Instagram are 3× more engaging than Reels this quarter. Summer drop campaign is underserved.</div>
          </div>
          <div style={{ color: 'var(--lime)', fontSize: 20, fontWeight: 700 }}>→</div>
        </div>
      )}

      <div className="sgrid">
        <div className="sc"><div className="slbl">Total Items</div><div className="sval" style={{ color: 'var(--pink)' }}>{content.length}</div><div className="sdlt muted">in your view</div></div>
        <div className="sc"><div className="slbl">Awaiting Review</div><div className="sval" style={{ color: '#ffbb44' }}>{pendingCount}</div><div className="sdlt warn">needs action</div></div>
        <div className="sc"><div className="slbl">Scheduled</div><div className="sval" style={{ color: '#78b8e8' }}>{scheduled}</div><div className="sdlt muted">→ upcoming</div></div>
        <div className="sc"><div className="slbl">Your Role</div><div className="sval" style={{ color: 'var(--green)', fontSize: 20 }}>{isCommand ? 'Command' : 'Freelance'}</div><div className="sdlt muted">{profile.title || ''}</div></div>
      </div>
    </>
  );
}

function Approvals({ content, role, brandScope, byStatus, brandColor }) {
  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Approvals</div>
          <div className="ps">
            {role === 'freelance'
              ? `Your items for ${brandScope || 'your brand'} · ${content.length} total`
              : `${content.length} items across all brands · briefed → scheduled`}
          </div>
        </div>
      </div>

      <div className="ap-note">
        <span style={{ fontSize: 15 }}>✦</span>
        <div>
          <b>Live data:</b> this board reads from Supabase. What you see is enforced by row-level security — freelancers only receive their own brand&apos;s rows from the database.
        </div>
      </div>

      <div className="ap-board">
        {STATUSES.map((s) => {
          const items = byStatus(s.id);
          return (
            <div className="ap-col" key={s.id}>
              <div className="ap-col-hd">
                <span className="ap-col-dot" style={{ background: s.color }} />
                <span className="ap-col-t" style={{ color: s.color }}>{s.label}</span>
                <span className="ap-col-n">{items.length}</span>
              </div>
              <div className="ap-col-bd">
                {items.length === 0 && <div className="ap-empty">—</div>}
                {items.map((i) => {
                  const bc = brandColor(i.brand);
                  return (
                    <div className="ap-card" key={i.id}>
                      <div className="ap-card-t">{i.title}</div>
                      <div className="ap-card-m">
                        <span className="ap-chip" style={{ background: bc + '22', color: bc }}>{i.brand}</span>
                      </div>
                      <div className="ap-card-ft">
                        <div className="ap-who" style={{ background: bc }}>{initials(i.owner_name || '')}</div>
                        <div className="ap-who-n">{i.owner_name}</div>
                        <div className="ap-due">{i.due_date || ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// =====================================================================
// BRAND CENTER — manage 5+ brands: voice, style, messaging, templates
// =====================================================================
function BrandCenter({ brands, isCommand, content }) {
  // view: 'list' | 'detail' | 'form'
  const [view, setView] = useState('list');
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null); // brand object or null (new)

  const open = brands.find((b) => b.id === openId);

  function openDetail(id) { setOpenId(id); setView('detail'); }
  function openNew() { setEditing(null); setView('form'); }
  function openEdit(brand) { setEditing(brand); setView('form'); }
  function backToList() { setView('list'); setOpenId(null); setEditing(null); }

  const [confirmDel, setConfirmDel] = useState(false);
  const [delState, deleteAction, deleting] = useActionState(deleteBrand, {});
  // After a successful delete, drop back to the list — once, not on every render.
  useEffect(() => {
    if (delState && delState.deleted) {
      setConfirmDel(false);
      setView('list');
      setOpenId(null);
      setEditing(null);
    }
  }, [delState]);

  // ----- FORM MODE -----
  if (view === 'form') {
    return <BrandForm brand={editing} onDone={backToList} onCancel={backToList} />;
  }

  // ----- DETAIL MODE -----
  if (view === 'detail' && open) {
    const items = content.filter((c) => c.brand === open.name);
    const field = (label, value) => (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text3)', lineHeight: 1.5 }}>{value || 'Not set'}</div>
      </div>
    );
    return (
      <>
        <div className="ph">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 13, flex: '0 0 52px', overflow: 'hidden', background: open.brand_book?.icon_url ? `center/cover no-repeat url(${open.brand_book.icon_url})` : open.color + '22', color: open.color, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700 }}>
              {!open.brand_book?.icon_url && (open.name || '?').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="pt" style={{ color: open.color }}>{open.name}</div>
              <div className="ps">{open.tagline}{open.category ? ` · ${open.category}` : ''}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCommand && <button className="btn bg" onClick={() => openEdit(open)}>✎ Edit</button>}
            {isCommand && !confirmDel && (
              <button className="btn bg" style={{ color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }} onClick={() => setConfirmDel(true)}>🗑 Delete</button>
            )}
            {isCommand && confirmDel && (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#ff6464' }}>Delete permanently?</span>
                <form action={deleteAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={open.id} />
                  <button className="btn" type="submit" disabled={deleting}
                    style={{ background: '#ff6464', color: '#111', borderColor: '#ff6464' }}>
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                </form>
                <button className="btn bg" onClick={() => setConfirmDel(false)}>Cancel</button>
              </span>
            )}
            <button className="btn bg" onClick={backToList}>← All brands</button>
          </div>
        </div>

        {/* Identity + Strategy */}
        <div className="dcols" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="ch"><div className="ct">Brand Identity</div></div>
            <div className="cb">
              {field('Mission', open.mission)}
              {field('Positioning', open.positioning)}
              {field('Category', open.category)}
            </div>
          </div>
          <div className="card">
            <div className="ch"><div className="ct">Strategy</div></div>
            <div className="cb">
              {field('Target Audience', open.audience)}
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 5 }}>Personality</div>
              <div className="bmr">
                {(open.personality || []).length === 0
                  ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>Not set</span>
                  : (open.personality || []).map((p, i) => <span className="tag" key={i} style={{ color: open.color }}>{p}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* Palette + Gallery (visual references) */}
        {(() => {
          const bb = open.brand_book || {};
          const pal = bb.palette || {};
          const palEntries = Object.entries(pal).filter(([, v]) => v);
          const gal = bb.gallery || [];
          if (palEntries.length === 0 && gal.length === 0) return null;
          const labelFor = (k) => k === 'black' ? 'Black' : k === 'white' ? 'White' : k.toUpperCase();
          return (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="ch"><div className="ct">Palette & References</div></div>
              <div className="cb">
                {palEntries.length > 0 && (
                  <div style={{ marginBottom: gal.length ? 18 : 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 8 }}>Color Palette</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {palEntries.map(([k, v]) => (
                        <div key={k} style={{ textAlign: 'center' }}>
                          <div style={{ width: 46, height: 46, borderRadius: 10, background: v, border: '1px solid var(--border)' }} />
                          <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 4, fontFamily: 'monospace' }}>{v}</div>
                          <div style={{ fontSize: 9, color: 'var(--text3)' }}>{labelFor(k)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {gal.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 8 }}>Reference Gallery</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {gal.map((g, i) => (
                        <div key={i} style={{ width: 150 }}>
                          <div style={{ width: 150, height: 110, borderRadius: 10, background: `center/cover no-repeat url(${g.url})`, border: '1px solid var(--border)' }} />
                          {g.caption && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>{g.caption}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Extended brand profile sections (from brand_book) */}
        {(() => {
          const bb = open.brand_book || {};
          const sec = (label, value) => {
            if (!value) return null;
            return (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{value}</div>
              </div>
            );
          };
          const groups = [
            ['Identity & Strategy', [
              ['Brand Story', bb.brand_story],
              ['Competitive Landscape', bb.competitive_landscape],
              ['Customer Personas', bb.customer_personas],
            ]],
            ['Visual', [
              ['Logo Rules', bb.logo_rules],
              ['Typography', bb.typography],
              ['Photography Direction', bb.photo_direction],
              ['Video Direction', bb.video_direction],
              ['Visual & Packaging', bb.packaging],
            ]],
            ['Content & Community', [
              ['Social Media Rules', bb.social_rules],
              ['Comment & Community Guidelines', bb.community_guidelines],
              ["Do's & Don'ts", bb.dos_donts],
              ['Vocabulary Dictionary', bb.vocab_dictionary],
              ['FAQs', bb.faqs],
              ['Seasonal Calendar', bb.seasonal_calendar],
              ['Campaign History', bb.campaign_history],
            ]],
            ['Legal & Compliance', [
              ['Legal Claims & Compliance', bb.legal_compliance],
            ]],
            ['AI', [
              ['AI Prompt Examples', bb.ai_prompts],
            ]],
          ];
          return groups.map(([title, rows]) => {
            const visible = rows.filter(([, v]) => v && v.trim());
            if (visible.length === 0) return null;
            return (
              <div className="card" style={{ marginBottom: 18 }} key={title}>
                <div className="ch"><div className="ct">{title}</div></div>
                <div className="cb">{visible.map(([l, v]) => sec(l, v))}</div>
              </div>
            );
          });
        })()}

        {/* Caption Playbook (machine-readable — feeds the Line-Up module) */}
        {(() => {
          const bb = open.brand_book || {};
          const hasAny = bb.caption_structure || (bb.ctas || []).length || (bb.hashtags_primary || []).length || (bb.vocab_preferred || []).length;
          const chipRow = (label, arr, color) => (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 5 }}>{label}</div>
              <div className="bmr">
                {(arr || []).length === 0
                  ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>Not set</span>
                  : arr.map((x, i) => <span className="tag" key={i} style={color ? { color } : {}}>{x}</span>)}
              </div>
            </div>
          );
          return (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="ch"><div className="ct">Caption Playbook</div><span style={{ fontSize: 11, color: 'var(--text3)' }}>feeds Line-Up</span></div>
              <div className="cb">
                {!hasAny && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Not configured yet — click Edit to set caption structure, CTAs, hashtags & vocabulary.</div>}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 3 }}>Caption Structure</div>
                  <div style={{ fontSize: 13, color: bb.caption_structure ? 'var(--text)' : 'var(--text3)' }}>{bb.caption_structure || 'Not set'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    {chipRow('Approved CTAs', bb.ctas, open.color)}
                    {chipRow('Primary Hashtags', bb.hashtags_primary)}
                    {chipRow('Preferred Words', bb.vocab_preferred, 'var(--green)')}
                  </div>
                  <div>
                    {chipRow('Content Pillars', bb.content_pillars, open.color)}
                    {chipRow('Secondary Hashtags', bb.hashtags_secondary)}
                    {chipRow('Words to Avoid', bb.vocab_banned, '#ff6464')}
                  </div>
                </div>
                {bb.emoji_rule && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text2)' }}><b>Emoji:</b> {bb.emoji_rule}</div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Voice + Style + Messaging */}
        <div className="dcols">
          <div className="card">
            <div className="ch"><div className="ct">Brand Voice</div></div>
            <div className="cb" style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {open.voice || 'No voice defined yet.'}
            </div>
            <div className="ch" style={{ borderTop: '1px solid var(--border)' }}><div className="ct">Style Guidelines</div></div>
            <div className="cb" style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {open.style_guide || 'No style guide defined yet.'}
            </div>
          </div>
          <div className="card">
            <div className="ch"><div className="ct">Approved Messaging</div></div>
            <div className="cb">
              {(open.messaging || []).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>No approved messaging yet.</div>
              )}
              {(open.messaging || []).map((m, idx) => (
                <div key={idx} className="ai">
                  <span className="adot" style={{ background: open.color }} />
                  <span className="atxt"><strong>{m}</strong></span>
                </div>
              ))}
            </div>
            <div className="ch" style={{ borderTop: '1px solid var(--border)' }}><div className="ct">Activity</div></div>
            <div className="cb" style={{ fontSize: 12, color: 'var(--text2)' }}>
              {items.length} content items in pipeline for this brand.
            </div>
          </div>
        </div>
      </>
    );
  }

  // ----- LIST MODE -----
  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Brand Center</div>
          <div className="ps">{brands.length} brands · voice, style, messaging & templates in one place</div>
        </div>
        {isCommand && <button className="btn bl" onClick={openNew}>＋ Add Brand</button>}
      </div>

      <div className="bgrid">
        {brands.map((b) => {
          const items = content.filter((c) => c.brand === b.name);
          return (
            <div className="bcard" key={b.id} onClick={() => openDetail(b.id)}>
              <div className="bc-hd">
                <div className="bc-av" style={{ background: b.color + '22', color: b.color }}>
                  {(b.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="bc-n">{b.name}</div>
                <div className="bc-d">{b.tagline}</div>
              </div>
              <div className="bc-bd">
                <div className="bmr">
                  {(b.messaging || []).slice(0, 3).map((m, i) => (
                    <span className="tag" key={i}>{m}</span>
                  ))}
                </div>
              </div>
              <div className="bc-ft">
                <div>
                  <div className="bsv" style={{ color: b.color }}>{items.length}</div>
                  <div className="bsl">Items</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="bsv">{(b.messaging || []).length}</div>
                  <div className="bsl">Pillars</div>
                </div>
              </div>
            </div>
          );
        })}

        {isCommand && (
          <div className="brand-new" onClick={openNew}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>＋</div>
            <div style={{ fontWeight: 600 }}>Add Brand</div>
          </div>
        )}
      </div>
    </>
  );
}

// Create / edit brand form. Uses a server action; revalidates the dashboard
// so the new/updated brand appears after save.
function BrandForm({ brand, onDone, onCancel }) {
  const [state, formAction, pending] = useActionState(saveBrand, {});
  const [color, setColor] = useState(brand?.color || '#EE268C');
  const [tab, setTab] = useState('identity');
  const [iconUrl, setIconUrl] = useState(brand?.brand_book?.icon_url || '');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  // Palette: 10 optional slots — 4 primary, 4 secondary, black, white.
  const PALETTE_SLOTS = [
    { key: 'p1', group: 'Primary' }, { key: 'p2', group: 'Primary' },
    { key: 'p3', group: 'Primary' }, { key: 'p4', group: 'Primary' },
    { key: 's1', group: 'Secondary' }, { key: 's2', group: 'Secondary' },
    { key: 's3', group: 'Secondary' }, { key: 's4', group: 'Secondary' },
    { key: 'black', group: 'Base' }, { key: 'white', group: 'Base' },
  ];
  const [paletteVals, setPaletteVals] = useState(() => {
    const saved = brand?.brand_book?.palette || {};
    return PALETTE_SLOTS.reduce((acc, s) => {
      acc[s.key] = saved[s.key] || '';
      return acc;
    }, {});
  });
  const [gallery, setGallery] = useState(() => brand?.brand_book?.gallery || []);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const bb = brand?.brand_book || {};

  useEffect(() => { if (state?.ok) setTimeout(onDone, 0); }, [state]);

  const palette = ['#EE268C', '#64BC46', '#AED8FF', '#FFAEF1', '#DDEE26'];
  const lbl = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 6, display: 'block' };
  const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: "'Inter',sans-serif" };
  const ta = (h = 80) => ({ ...inp, minHeight: h, resize: 'vertical' });
  const hint = { fontSize: 11, color: 'var(--text3)', marginTop: 5 };
  const Field = ({ label, children, sub }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      {children}
      {sub && <div style={hint}>{sub}</div>}
    </div>
  );

  async function handleIcon(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(''); setUploading(true);
    try {
      const supabase = createBrowserClient();
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${(brand?.id || 'new')}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('brand-icons').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('brand-icons').getPublicUrl(path);
      setIconUrl(data.publicUrl);
    } catch (err) {
      setUploadErr(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleGallery(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadErr(''); setGalleryUploading(true);
    try {
      const supabase = createBrowserClient();
      const added = [];
      for (const file of files) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${(brand?.id || 'new')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await supabase.storage.from('brand-gallery').upload(path, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('brand-gallery').getPublicUrl(path);
        added.push({ url: data.publicUrl, caption: '' });
      }
      setGallery((g) => [...g, ...added]);
    } catch (err) {
      setUploadErr(err.message || 'Gallery upload failed.');
    } finally {
      setGalleryUploading(false);
    }
  }

  function removeGalleryItem(i) {
    setGallery((g) => g.filter((_, idx) => idx !== i));
  }
  function setGalleryCaption(i, val) {
    setGallery((g) => g.map((item, idx) => (idx === i ? { ...item, caption: val } : item)));
  }
  function setSlot(key, val) {
    setPaletteVals((p) => ({ ...p, [key]: val }));
  }

  const TABS = [
    ['identity', 'Identity'],
    ['visual', 'Visual'],
    ['content', 'Content'],
    ['legal', 'Legal'],
    ['ai', 'AI'],
  ];

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">{brand ? 'Edit Brand' : 'New Brand'}</div>
          <div className="ps">{brand ? 'Update this brand’s profile' : 'Add a brand to your Creative OS'}</div>
        </div>
        <button className="btn bg" onClick={onCancel}>← Cancel</button>
      </div>

      <form action={formAction} style={{ maxWidth: 720 }}>
        {brand?.id && <input type="hidden" name="id" value={brand.id} />}
        <input type="hidden" name="color" value={(() => {
          const p1 = paletteVals.p1;
          if (p1) { return p1.startsWith('#') ? p1 : '#' + p1.replace(/[^0-9a-fA-F]/g, ''); }
          return color;
        })()} />
        <input type="hidden" name="icon_url" value={iconUrl} />
        <input type="hidden" name="palette" value={JSON.stringify(
          Object.fromEntries(Object.entries(paletteVals).map(([k, v]) => {
            if (!v) return [k, ''];
            const h = v.startsWith('#') ? v : '#' + v.replace(/[^0-9a-fA-F]/g, '');
            return [k, h];
          }))
        )} />
        <input type="hidden" name="gallery" value={JSON.stringify(gallery)} />

        {/* ICON + NAME header card (always visible) */}
        <div className="card" style={{ padding: 22, marginBottom: 16, display: 'flex', gap: 18, alignItems: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, flex: '0 0 64px', background: iconUrl ? `center/cover no-repeat url(${iconUrl})` : color + '22', color, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 700, overflow: 'hidden' }}>
            {!iconUrl && (brand?.name || '?').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Brand Name *">
              <input style={inp} name="name" defaultValue={brand?.name || ''} placeholder="e.g. OH HEY THERE Matcha Cafe" required />
            </Field>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label className="btn bg bsm" style={{ cursor: 'pointer' }}>
                {uploading ? 'Uploading…' : iconUrl ? 'Change icon' : '⬆ Upload icon'}
                <input type="file" accept="image/*" onChange={handleIcon} style={{ display: 'none' }} />
              </label>
              {iconUrl && <button type="button" className="btn bg bsm" onClick={() => setIconUrl('')}>Remove</button>}
              {uploadErr && <span style={{ fontSize: 12, color: '#ff6464' }}>{uploadErr}</span>}
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`fb ${tab === id ? 'on' : ''}`}>{label}</button>
          ))}
        </div>

        {/* ---------------- IDENTITY ---------------- */}
        {tab === 'identity' && (
          <div className="card" style={{ padding: 22 }}>
            <Field label="Tagline"><input style={inp} name="tagline" defaultValue={brand?.tagline || ''} placeholder="Short descriptor" /></Field>
            <Field label="Category"><input style={inp} name="category" defaultValue={brand?.category || ''} placeholder="e.g. Specialty Cafe, Tea Line, Apparel" /></Field>
            <Field label="Mission"><textarea style={ta(70)} name="mission" defaultValue={brand?.mission || ''} placeholder="What this brand exists to do." /></Field>
            <Field label="Positioning"><input style={inp} name="positioning" defaultValue={brand?.positioning || ''} placeholder="One sentence: who you are for whom." /></Field>
            <Field label="Target Audience"><textarea style={ta(70)} name="audience" defaultValue={brand?.audience || ''} placeholder="Who you're speaking to." /></Field>
            <Field label="Brand Personality" sub="Comma-separated traits."><input style={inp} name="personality" defaultValue={(brand?.personality || []).join(', ')} placeholder="e.g. Curious, Warm, Confident, Playful" /></Field>
            <Field label="Brand Story" sub="The full narrative — include origin and founder philosophy here."><textarea style={ta(120)} name="brand_story" defaultValue={bb.brand_story || ''} placeholder="How the brand started, why it exists, what the founders believe." /></Field>
            <Field label="Competitive Landscape" sub="Who else is in the space and how you're different."><textarea style={ta(90)} name="competitive_landscape" defaultValue={bb.competitive_landscape || ''} placeholder="Key competitors, your edge, what you avoid copying." /></Field>
            <Field label="Customer Personas" sub="One persona per line, or a short paragraph each."><textarea style={ta(100)} name="customer_personas" defaultValue={bb.customer_personas || ''} placeholder={'The Curious Newcomer — first time trying matcha…\nThe Regular — comes weekly, values consistency…'} /></Field>
          </div>
        )}

        {/* ---------------- VISUAL ---------------- */}
        {tab === 'visual' && (
          <div className="card" style={{ padding: 22 }}>
            {/* FULL PALETTE — 10 optional slots */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Color Palette</label>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Tap a swatch to set its hex. Leave any blank if unused.</div>
              {['Primary', 'Secondary', 'Base'].map((group) => (
                <div key={group} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>{group}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {PALETTE_SLOTS.filter((s) => s.group === group).map((s) => {
                      const raw = paletteVals[s.key];
                      const val = raw ? (raw.startsWith('#') ? raw : '#' + raw.replace(/[^0-9a-fA-F]/g, '')) : '';
                      const valid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val);
                      const label = s.key === 'black' ? 'Black' : s.key === 'white' ? 'White' : '';
                      return (
                        <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                          <label style={{ cursor: 'pointer', position: 'relative' }}>
                            <div style={{ width: 46, height: 46, borderRadius: 10, background: valid ? val : 'transparent', border: valid ? '1px solid var(--border)' : '1.5px dashed var(--border)', display: 'grid', placeItems: 'center', color: 'var(--text3)', fontSize: 18 }}>
                              {!valid && '+'}
                            </div>
                            <input type="color" value={valid ? val : '#000000'} onChange={(e) => setSlot(s.key, e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                          </label>
                          <input
                            value={raw}
                            onChange={(e) => setSlot(s.key, e.target.value)}
                            placeholder={label || '#hex'}
                            style={{ width: 72, fontSize: 11, textAlign: 'center', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', color: 'var(--text)', fontFamily: 'monospace' }}
                          />
                          {raw && <span onClick={() => setSlot(s.key, '')} style={{ fontSize: 10, color: 'var(--text3)', cursor: 'pointer' }}>clear</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Field label="Style Guidelines"><textarea style={ta(90)} name="style_guide" defaultValue={brand?.style_guide || ''} placeholder="Visual rules — colors, type, imagery, do’s and don’ts." /></Field>
            <Field label="Logo Rules" sub="Clear space, minimum size, what not to do."><textarea style={ta(80)} name="logo_rules" defaultValue={bb.logo_rules || ''} placeholder="How the logo should and shouldn't be used." /></Field>
            <Field label="Typography" sub="Fonts, weights, hierarchy."><textarea style={ta(80)} name="typography" defaultValue={bb.typography || ''} placeholder="Headline font, body font, when to use each." /></Field>
            <Field label="Photography Direction"><textarea style={ta(80)} name="photo_direction" defaultValue={bb.photo_direction || ''} placeholder="Lighting, mood, composition, color grading." /></Field>
            <Field label="Video Direction"><textarea style={ta(80)} name="video_direction" defaultValue={bb.video_direction || ''} placeholder="Pacing, music, captions, format per platform." /></Field>
            <Field label="Visual & Packaging Notes"><textarea style={ta(80)} name="packaging" defaultValue={bb.packaging || ''} placeholder="Cup design, labels, stickers, print standards." /></Field>

            {/* REFERENCE GALLERY */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
              <label style={lbl}>Reference Gallery</label>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Upload example photos that show the look — moodboard, product shots, do/don't examples.</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                {gallery.map((g, i) => (
                  <div key={i} style={{ width: 130 }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: 130, height: 100, borderRadius: 10, background: `center/cover no-repeat url(${g.url})`, border: '1px solid var(--border)' }} />
                      <button type="button" onClick={() => removeGalleryItem(i)} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>×</button>
                    </div>
                    <input value={g.caption} onChange={(e) => setGalleryCaption(i, e.target.value)} placeholder="Caption (optional)" style={{ width: '100%', marginTop: 5, fontSize: 11, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', color: 'var(--text)' }} />
                  </div>
                ))}
                <label className="btn bg" style={{ cursor: 'pointer', width: 130, height: 100, display: 'grid', placeItems: 'center', borderStyle: 'dashed' }}>
                  {galleryUploading ? 'Uploading…' : '＋ Add photos'}
                  <input type="file" accept="image/*" multiple onChange={handleGallery} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- CONTENT ---------------- */}
        {tab === 'content' && (
          <>
            <div className="card" style={{ padding: 22 }}>
              <Field label="Brand Voice"><textarea style={ta(90)} name="voice" defaultValue={brand?.voice || ''} placeholder="How this brand speaks — tone, attitude." /></Field>
              <Field label="Approved Messaging" sub="One messaging pillar per line."><textarea style={ta(80)} name="messaging" defaultValue={(brand?.messaging || []).join('\n')} placeholder="One pillar per line (or comma-separated)" /></Field>
              <Field label="Social Media Rules"><textarea style={ta(80)} name="social_rules" defaultValue={bb.social_rules || ''} placeholder="Posting cadence, platform do's/don'ts, formatting." /></Field>
              <Field label="Comment & Community Response Guidelines"><textarea style={ta(90)} name="community_guidelines" defaultValue={bb.community_guidelines || ''} placeholder="Tone for replies, how to handle complaints, DMs, escalations." /></Field>
              <Field label="Do's & Don'ts" sub="One per line."><textarea style={ta(90)} name="dos_donts" defaultValue={bb.dos_donts || ''} placeholder={"DO: keep captions warm and short\nDON'T: use corporate jargon"} /></Field>
              <Field label="Brand Vocabulary Dictionary" sub="Words/phrases unique to the brand and their meaning."><textarea style={ta(80)} name="vocab_dictionary" defaultValue={bb.vocab_dictionary || ''} placeholder={'"OH HEY THERE moment" = a small joyful pause in the day'} /></Field>
              <Field label="Frequently Asked Questions"><textarea style={ta(90)} name="faqs" defaultValue={bb.faqs || ''} placeholder={'Q: Do you have oat milk?\nA: Yes, always.'} /></Field>
              <Field label="Seasonal Marketing Calendar"><textarea style={ta(80)} name="seasonal_calendar" defaultValue={bb.seasonal_calendar || ''} placeholder="Key dates, seasonal drops, recurring campaigns by month." /></Field>
              <Field label="Campaign History"><textarea style={ta(80)} name="campaign_history" defaultValue={bb.campaign_history || ''} placeholder="Past campaigns and how they performed." /></Field>
            </div>

            {/* Caption Playbook stays its own card */}
            <div className="card" style={{ padding: 22, marginTop: 16 }}>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Caption Playbook</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>Structured data the Line-Up module uses to auto-build captions.</div>
              <Field label="Caption Structure" sub="The shape every caption follows."><input style={inp} name="caption_structure" defaultValue={bb.caption_structure || ''} placeholder="e.g. Hook → body → CTA → hashtags" /></Field>
              <Field label="Content Pillars" sub="Comma-separated."><input style={inp} name="content_pillars" defaultValue={(bb.content_pillars || []).join(', ')} placeholder="Education, Products, Community" /></Field>
              <Field label="Approved CTAs" sub="One per line."><textarea style={ta(70)} name="ctas" defaultValue={(bb.ctas || []).join('\n')} placeholder={'Visit us in BF Homes\nTry it this week'} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div><label style={lbl}>Primary Hashtags</label><textarea style={ta(70)} name="hashtags_primary" defaultValue={(bb.hashtags_primary || []).join('\n')} placeholder={'#ohheythere\n#matcha'} /></div>
                <div><label style={lbl}>Secondary Hashtags</label><textarea style={ta(70)} name="hashtags_secondary" defaultValue={(bb.hashtags_secondary || []).join('\n')} placeholder={'#bfhomes\n#cafehopping'} /></div>
              </div>
              <Field label="Banned Hashtags"><input style={inp} name="hashtags_banned" defaultValue={(bb.hashtags_banned || []).join(', ')} placeholder="Comma-separated tags to never use" /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div><label style={lbl}>Preferred Vocabulary</label><textarea style={ta(70)} name="vocab_preferred" defaultValue={(bb.vocab_preferred || []).join('\n')} placeholder={'ceremonial\nwhisked'} /></div>
                <div><label style={lbl}>Words to Avoid</label><textarea style={ta(70)} name="vocab_banned" defaultValue={(bb.vocab_banned || []).join('\n')} placeholder={'cheap\nbest'} /></div>
              </div>
              <Field label="Emoji Rule"><input style={inp} name="emoji_rule" defaultValue={bb.emoji_rule || ''} placeholder="e.g. Sparingly — 1 max, never in headlines" /></Field>
            </div>
            <div style={{ ...hint, marginTop: 10 }}>📁 <strong>Menu Database</strong> & <strong>Product Knowledge Base</strong> are structured-data modules coming in a later build.</div>
          </>
        )}

        {/* ---------------- LEGAL ---------------- */}
        {tab === 'legal' && (
          <div className="card" style={{ padding: 22 }}>
            <Field label="Legal Claims & Compliance" sub="Claims you can/can't make, required disclaimers, regulated language."><textarea style={ta(140)} name="legal_compliance" defaultValue={bb.legal_compliance || ''} placeholder={'Approved claims, banned claims, allergen notes, promo T&Cs.'} /></Field>
          </div>
        )}

        {/* ---------------- AI ---------------- */}
        {tab === 'ai' && (
          <div className="card" style={{ padding: 22 }}>
            <Field label="AI Prompt Examples" sub="Good prompts for generating on-brand content — the Strategist can reuse these."><textarea style={ta(160)} name="ai_prompts" defaultValue={bb.ai_prompts || ''} placeholder={'"Write a warm, short IG caption for a new seasonal drink, 1 emoji max…"'} /></Field>
          </div>
        )}

        {state?.error && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,100,100,.12)', border: '1px solid rgba(255,100,100,.3)', borderRadius: 'var(--rs)', color: '#ff6464', fontSize: 13 }}>{state.error}</div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn bl" type="submit" disabled={pending || uploading}>
            {pending ? 'Saving…' : brand ? 'Save changes' : 'Create brand'}
          </button>
          <button className="btn bg" type="button" onClick={onCancel}>Cancel</button>
        </div>
        <div style={{ ...hint, marginTop: 8 }}>Tip: fields are saved across all tabs when you click Save — switch tabs freely before saving.</div>
      </form>
    </>
  );
}

function ContentCenter({ content, brands, brandColor, subView }) {
  const [brandFilter, setBrandFilter] = useState('all');
  const STAT = {
    briefed: { c: 's-dr', label: 'Briefed' },
    progress: { c: 's-sc', label: 'In Progress' },
    submitted: { c: 's-rv', label: 'Submitted' },
    changes: { c: 's-rv', label: 'Changes Req.' },
    approved: { c: 's-lv', label: 'Approved' },
    scheduled: { c: 's-sc', label: 'Scheduled' },
  };
  const rows = content.filter((c) => brandFilter === 'all' || c.brand === brandFilter);

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Content Center</div>
          <div className="ps">{rows.length} items · planning, cadence & team assignments</div>
        </div>
      </div>

      <div className="cfilts">
        <button className={`fb ${brandFilter === 'all' ? 'on' : ''}`} onClick={() => setBrandFilter('all')}>All brands</button>
        {brands.map((b) => (
          <button
            key={b.id}
            className={`fb ${brandFilter === b.name ? 'on' : ''}`}
            onClick={() => setBrandFilter(b.name)}
            style={brandFilter === b.name ? { color: b.color, borderColor: b.color + '66', background: b.color + '1a' } : {}}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="ctbl">
        <div className="tblh">
          <div className="th">Title</div>
          <div className="th">Brand</div>
          <div className="th">Status</div>
          <div className="th">Owner</div>
          <div className="th">Channel</div>
          <div className="th">Due</div>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No items.</div>
        )}
        {rows.map((r) => {
          const s = STAT[r.status] || STAT.briefed;
          const bc = brandColor(r.brand);
          return (
            <div className="tr" key={r.id}>
              <div className="tdt">{r.title}</div>
              <div className="td"><span className="sb2" style={{ background: bc + '22', color: bc }}>{r.brand}</span></div>
              <div className="td"><span className={`sb2 ${s.c}`}>{s.label}</span></div>
              <div className="td">{r.owner_name || '—'}</div>
              <div className="td">{r.channel || '—'}</div>
              <div className="td">{r.due_date || '—'}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// =====================================================================
// PUBLISHING CENTER — calendar of scheduled content across channels
// =====================================================================
function PublishingCenter({ content, brands, brandColor, subView }) {
  const now = new Date();
  const [view, setView] = useState('month');
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // map content with a publish/due date in this month → day number
  const events = {};
  content.forEach((c) => {
    const ds = c.publish_at || c.due_date;
    if (!ds) return;
    const d = new Date(ds);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      (events[day] = events[day] || []).push(c);
    }
  });

  const channelClass = (ch) => {
    const m = { instagram: 'ei', youtube: 'ee', linkedin: 'el', tiktok: 'et' };
    return m[(ch || '').toLowerCase()] || 'ei';
  };
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Publishing Center</div>
          <div className="ps">Schedule & distribute across channels from one calendar</div>
        </div>
      </div>

      <div className="cal-hd">
        <div className="cmon">{monthName} {year}</div>
        <div className="cvws">
          {['month', 'board', 'timeline'].map((v) => (
            <div key={v} className={`cvw ${view === v ? 'on' : ''}`} onClick={() => setView(v)} style={{ textTransform: 'capitalize' }}>{v}</div>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <div className="calgrid">
          <div className="cday-hd">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div className="cdlbl" key={d}>{d}</div>
            ))}
          </div>
          <div className="cgrid">
            {cells.map((d, i) => (
              <div className={`cc ${d === now.getDate() ? 'today' : ''} ${d === null ? 'om' : ''}`} key={i}>
                {d && <div className="ccn">{d}</div>}
                {d && (events[d] || []).map((e) => (
                  <div className={`cev ${channelClass(e.channel)}`} key={e.id} title={e.title}>
                    {e.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {view !== 'month' && (
        <div className="ctbl">
          <div className="tblh" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr' }}>
            <div className="th">Title</div><div className="th">Brand</div><div className="th">Channel</div><div className="th">Publishes</div>
          </div>
          {content.filter((c) => c.status === 'scheduled' || c.publish_at).length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nothing scheduled.</div>
          )}
          {content.filter((c) => c.status === 'scheduled' || c.publish_at).map((c) => {
            const bc = brandColor(c.brand);
            return (
              <div className="tr" key={c.id} style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr' }}>
                <div className="tdt">{c.title}</div>
                <div className="td"><span className="sb2" style={{ background: bc + '22', color: bc }}>{c.brand}</span></div>
                <div className="td">{c.channel || '—'}</div>
                <div className="td">{c.publish_at ? new Date(c.publish_at).toLocaleDateString() : (c.due_date || '—')}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// =====================================================================
// ANALYTICS CENTER — reach, engagement, CTR, conversion, revenue + recs
// =====================================================================
function AnalyticsCenter({ content, brands, brandColor, subView }) {
  const sum = (k) => content.reduce((a, c) => a + (Number(c[k]) || 0), 0);
  const totalReach = sum('reach');
  const totalEng = sum('engagement');
  const totalConv = sum('conversions');
  const totalRev = sum('revenue');
  const avgCtr = content.length
    ? (content.reduce((a, c) => a + (Number(c.ctr) || 0), 0) / content.length).toFixed(2)
    : '0.00';
  const engRate = totalReach ? ((totalEng / totalReach) * 100).toFixed(1) : '0.0';
  const convRate = totalReach ? ((totalConv / totalReach) * 100).toFixed(2) : '0.00';

  // top performers by engagement
  const top = [...content].sort((a, b) => (b.engagement || 0) - (a.engagement || 0)).slice(0, 5);

  // per-brand revenue for the bar chart
  const byBrand = brands.map((b) => ({
    name: b.name,
    color: b.color,
    rev: content.filter((c) => c.brand === b.name).reduce((a, c) => a + (Number(c.revenue) || 0), 0),
  }));
  const maxRev = Math.max(1, ...byBrand.map((b) => b.rev));

  // a simple actionable recommendation
  const bestBrand = byBrand.slice().sort((a, b) => b.rev - a.rev)[0];
  const bestChannel = (() => {
    const m = {};
    content.forEach((c) => { if (c.channel) m[c.channel] = (m[c.channel] || 0) + (c.engagement || 0); });
    const e = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    return e ? e[0] : null;
  })();

  const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Analytics Center</div>
          <div className="ps">Reach, engagement, CTR, conversion & revenue — with recommendations</div>
        </div>
      </div>

      <div className="intel">
        <div className="intel-ic">✦</div>
        <div style={{ flex: 1 }}>
          <div className="intel-lbl">Recommendation</div>
          <div className="intel-q">
            {bestBrand && bestBrand.rev > 0
              ? `${bestBrand.name} is driving the most revenue${bestChannel ? ` and ${bestChannel} is your top engagement channel` : ''}.`
              : 'Add performance data to content items to unlock recommendations.'}
          </div>
          <div className="intel-s">
            {bestBrand && bestBrand.rev > 0
              ? `Double down: schedule more ${bestChannel || 'high-performing'} content for ${bestBrand.name} next cycle.`
              : 'Populate reach, engagement, ctr, conversions & revenue on content_items.'}
          </div>
        </div>
      </div>

      <div className="sgrid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <div className="sc"><div className="slbl">Reach</div><div className="sval" style={{ color: 'var(--pink)' }}>{fmt(totalReach)}</div><div className="sdlt muted">total</div></div>
        <div className="sc"><div className="slbl">Engagement</div><div className="sval" style={{ color: 'var(--green)' }}>{engRate}%</div><div className="sdlt muted">rate</div></div>
        <div className="sc"><div className="slbl">CTR</div><div className="sval" style={{ color: '#78b8e8' }}>{avgCtr}%</div><div className="sdlt muted">avg</div></div>
        <div className="sc"><div className="slbl">Conversion</div><div className="sval" style={{ color: '#d472c8' }}>{convRate}%</div><div className="sdlt muted">rate</div></div>
        <div className="sc"><div className="slbl">Revenue</div><div className="sval" style={{ color: 'var(--lime)' }}>${fmt(totalRev)}</div><div className="sdlt muted">attributed</div></div>
      </div>

      <div className="agrid">
        <div className="card">
          <div className="ch"><div className="ct">Revenue by Brand</div></div>
          <div className="cb">
            <div className="cbars">
              {byBrand.map((b) => (
                <div
                  key={b.name}
                  className="cbar"
                  title={`${b.name}: $${fmt(b.rev)}`}
                  style={{ height: `${Math.max(4, (b.rev / maxRev) * 100)}%`, background: b.color }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {byBrand.map((b) => (
                <span className="tag" key={b.name} style={{ color: b.color }}>{b.name} ${fmt(b.rev)}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="ch"><div className="ct">Top Performers</div></div>
          <div className="cb">
            {top.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>No data yet.</div>}
            {top.map((c, i) => (
              <div className="pli" key={c.id}>
                <div className="prk">{i + 1}</div>
                <div className="pinf2">
                  <div className="ptt">{c.title}</div>
                  <div className="pmt">{c.brand}{c.channel ? ` · ${c.channel}` : ''}</div>
                </div>
                <div className="pmtc">
                  <div className="pv" style={{ color: brandColor(c.brand) }}>{fmt(c.engagement || 0)}</div>
                  <div className="pl">engagement</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Stub({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>◌</div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13 }}>Coming in next build</div>
    </div>
  );
}
