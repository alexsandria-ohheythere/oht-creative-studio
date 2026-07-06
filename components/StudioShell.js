'use client';

import { useState, useEffect, useRef, useActionState } from 'react';
import appConfig from '../config/app.json';
import { saveBrand, archiveBrand, deleteBrand } from '../app/dashboard/brand-actions';
import { saveCampaign, deleteCampaign } from '../app/dashboard/campaign-actions';
import { saveAsset, deleteAsset } from '../app/dashboard/asset-actions';
import {
  saveTheme, deleteTheme,
  saveItem, setItemStatus, setItemAttachments, deleteItem,
  saveMcAsset, deleteMcAsset,
} from '../app/dashboard/mc-actions';
import {
  saveIdea, deleteIdea, duplicateIdea, setIdeaReady, promoteIdeaToProduction,
  saveContent, setContentStatus, deleteContent, setContentAttachments,
} from '../app/dashboard/content-actions';
import { createClient as createBrowserClient } from '../lib/supabase-browser';

// Access model:
//  - role 'command'   → full access (Alex, CJ)
//  - role 'freelance' → scoped to brand_scope (Tali)
// Nav, statuses, and brand colors are editable in config/app.json
const NAV = appConfig.nav;
const STATUSES = appConfig.statuses;
const BRAND_COLOR = appConfig.brandColors;
const GROUP_COLOR = appConfig.groupColors || {};

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function StudioShell({ profile, email, content, brands = [], campaigns = [], ideas = [], assets = [], mcThemes = [], mcItems = [], mcAssets = [], googleConnected = false }) {
  const role = profile.role === 'command' ? 'command' : 'freelance';
  const visibleNav = NAV.filter((n) => n.roles.includes(role));

  // Every navigable id (parents + children) — used to validate the URL hash.
  const validIds = new Set();
  NAV.forEach((n) => {
    validIds.add(n.id);
    (n.children || []).forEach((c) => validIds.add(c.id));
  });
  const idFromHash = () => {
    if (typeof window === 'undefined') return 'dash';
    const h = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
    return validIds.has(h) ? h : 'dash';
  };

  const [active, setActive] = useState('dash');
  const [clicked, setClicked] = useState(null); // id pulsing right now (click feedback)
  const [drawer, setDrawer] = useState(false);
  const [openGroups, setOpenGroups] = useState({}); // expandable sub-nav

  // On mount, adopt the section named in the URL hash so a refresh or a
  // shared/bookmarked link (e.g. /dashboard#camp) lands on the right module.
  useEffect(() => {
    setActive(idFromHash());
    // Only react to hash changes that DON'T already match what a click set —
    // this avoids a redundant second render on every sidebar tap (the click
    // sets state instantly; the hash write would otherwise re-set the same id).
    const onHash = () => {
      const next = idFromHash();
      setActive((cur) => (cur === next ? cur : next));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sections = [...new Set(visibleNav.map((n) => n.section))];
  const isCommand = role === 'command';
  // Command normally implies full delete rights, but a specific command
  // user can have that narrowed (profiles.can_delete = false) without
  // losing view/create/edit access. Defaults to true so this has no
  // effect unless the column is explicitly set otherwise.
  const canDelete = profile.can_delete !== false;

  const brandColor = (name) => {
    const b = brands.find((x) => x.name === name);
    return (b && b.color) || BRAND_COLOR[name] || '#9494AA';
  };

  const byStatus = (s) => content.filter((c) => c.status === s);
  // Real content statuses: in_production | review | approved.
  const pendingCount = content.filter((c) => c.status === 'review').length;

  function go(id) {
    // 1. Instant motion feedback — fire a short pulse on the tapped item.
    setClicked(id);
    setTimeout(() => setClicked((c) => (c === id ? null : c)), 220);

    // 2. Switch panels immediately so the UI reacts on this same frame.
    setActive(id);
    setDrawer(false);

    // 3. Reflect it in the URL AFTER paint. Writing location.hash fires the
    //    'hashchange' listener (which keeps back/forward + bookmarks working);
    //    deferring it past the next frame means the panel change renders first
    //    instead of waiting on a second, redundant render pass.
    if (typeof window !== 'undefined') {
      const target = `#${id}`;
      if (window.location.hash !== target) {
        requestAnimationFrame(() => { window.location.hash = id; });
      }
    }
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
                      className={`ni ${on ? 'on' : ''} ${n.flagship ? 'flagship' : ''} ${clicked === (hasKids ? n.children[0].id : n.id) ? 'pulse' : ''}`}
                      style={on ? { boxShadow: `inset 3px 0 0 ${GROUP_COLOR[sec] || 'var(--pink)'}` } : {}}
                      onClick={() => go(hasKids ? (n.children[0].id) : n.id)}
                    >
                      <span
                        className="ni-ic"
                        style={on
                          ? { color: GROUP_COLOR[sec] || 'var(--pink)', filter: `drop-shadow(0 0 6px ${GROUP_COLOR[sec] || 'var(--pink)'})` }
                          : { color: 'var(--text3)' }}
                      >{n.icon}</span> {n.label}
                      {n.pill && <span className="ni-pill">{n.pill}</span>}
                      {n.id === 'camp' && <span className="ni-pill">{campaigns.length}</span>}
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
                            className={`ni-kid ${active === c.id ? 'on' : ''} ${c.soon ? 'soon' : ''} ${clicked === c.id ? 'pulse' : ''}`}
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
              {isCommand && <button type="button" className="btn bg" onClick={() => go('content.assets')}>⊕ New Asset</button>}
              <button type="button" className="btn bl" onClick={() => go('strategist')}>✦ Ask the OS</button>
            </div>
          </div>

          <div className="content">
            {parentId === 'dash' && (
              <Dashboard profile={profile} content={content} isCommand={isCommand} pendingCount={pendingCount} />
            )}

            {parentId === 'brain' && (
              <BrandCenter brands={brands} isCommand={isCommand} canDelete={canDelete} content={content} />
            )}

            {parentId === 'camp' && (
              <Campaigns isCommand={isCommand} canDelete={canDelete} campaigns={campaigns} content={content} brands={brands} brandColor={brandColor} />
            )}

            {parentId === 'content' && (
              <ContentCenter content={content} ideas={ideas} brands={brands} campaigns={campaigns} assets={assets} isCommand={isCommand} canDelete={canDelete} brandColor={brandColor} subView={subView} googleConnected={googleConnected} />
            )}

            {parentId === 'mc' && subView === 'theme' && (
              <ThemeCenter mcThemes={mcThemes} mcItems={mcItems} brands={brands} isCommand={isCommand} />
            )}

            {parentId === 'mc' && subView === 'content' && (
              <LineUpView mcItems={mcItems} mcThemes={mcThemes} brands={brands} isCommand={isCommand} />
            )}

            {parentId === 'mc' && subView === 'production' && (
              <AssemblyView mcItems={mcItems} mcThemes={mcThemes} brands={brands} isCommand={isCommand} />
            )}

            {parentId === 'mc' && subView === 'assets' && (
              <McAssetLibrary mcAssets={mcAssets} mcItems={mcItems} mcThemes={mcThemes} brands={brands} brandColor={brandColor} isCommand={isCommand} />
            )}

            {parentId === 'publishing' && (
              <PublishingCenter content={content} ideas={ideas} brands={brands} brandColor={brandColor} subView={subView} />
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
// CAMPAIGNS — groups content into initiatives with goals, dates & rollups
// Reads the real campaigns table: brand_id, name, goal, status, starts_on,
// ends_on. Content links via content_items.campaign_id; rollups aggregate
// reach / engagement / conversions / revenue from linked content.
// list → detail → form.
// =====================================================================
const CAMP_STATUS = [
  { id: 'planning', label: 'Planning', color: '#9494AA' },
  { id: 'active',   label: 'Active',   color: '#64BC46' },
  { id: 'done',     label: 'Done',     color: '#78b8e8' },
];
const campStatus = (id) => CAMP_STATUS.find((s) => s.id === id) || CAMP_STATUS[0];

// Channels and the formats available within each. Used by Ideas + Briefs.
const CHANNELS = ['TikTok', 'Instagram', 'Threads', 'Facebook', 'YouTube'];
const FORMATS_BY_CHANNEL = {
  TikTok: [
    'Short Form Video (60s)', 'Micro Video (6s-15s)', 'Duets Video',
    'Stitches Video', 'Carousel', 'Story',
  ],
  Instagram: [
    'Reels', 'Stories', 'Grid Posts', 'Carousel',
    'Carousel - Mixed Media', 'Carousel - Guide', 'Link Post (Articles)',
  ],
  Threads: ['Text-based', 'Media-based', 'Conversational'],
  Facebook: [
    'Text Posts', 'Status Updates', 'Reels', 'Stories',
    'Video Post', 'Photo', 'Link Post (Articles)',
  ],
  YouTube: ['Long-Form Videos', 'YouTube Shorts', 'Live Streams', 'Podcasts'],
  Blog: [
    'Academy (Educational)', 'Origin Stories', 'Science (Explanation)',
    'Guide', 'Review', 'Journal', 'Suggestions', 'Deep Dive',
    'Sustainability', 'Culture & History',
  ],
};
// Semantic channel colors (aligns with brand color system in memory).
const CHANNEL_COLOR = {
  TikTok: '#FFAEF1', Instagram: '#EF4576', Threads: '#2D2D38',
  Facebook: '#AED8FF', YouTube: '#64BC46', Blog: '#DDEE26',
};

// Compute a YYYY-MM-DD that is `days` before a publish date (for live preview).
function dueBeforeClient(publish, days) {
  if (!publish) return null;
  const d = new Date(publish + 'T00:00:00Z');
  if (isNaN(d)) return null;
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function prettyDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Compact read-only row of the three dates, shown on idea/brief cards.
function DateRow({ publish, production, edit }) {
  if (!publish && !production && !edit) return null;
  const item = (label, value, color) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{prettyDate(value)}</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 6, background: 'var(--bg3)' }}>
      {item('Publish', publish, 'var(--text)')}
      {item('Production due', production, '#ffbb44')}
      {item('Edit due', edit, '#78b8e8')}
    </div>
  );
}

// Live preview of the two auto-computed due dates under a publish-date input.
function DueDatePreview({ publish }) {
  if (!publish) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
        Set a publish date and the due dates below are calculated automatically.
      </div>
    );
  }
  const prod = dueBeforeClient(publish, 5);
  const edit = dueBeforeClient(publish, 3);
  const chip = (label, value, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--bg3)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: '0 0 7px' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', marginLeft: 'auto' }}>{prettyDate(value)}</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {chip('Production Due · 5 days before', prod, '#ffbb44')}
      {chip('Edit Due · 3 days before', edit, '#78b8e8')}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtRange(a, b) {
  const fa = fmtDate(a), fb = fmtDate(b);
  if (fa && fb) return `${fa} → ${fb}`;
  if (fa) return `From ${fa}`;
  if (fb) return `Until ${fb}`;
  return 'No dates set';
}
function fmtNum(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
  return String(v);
}
function fmtMoney(n) {
  const v = Number(n) || 0;
  return '₱' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function Campaigns({ isCommand, canDelete = true, campaigns = [], content = [], brands = [], brandColor }) {
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'form'
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);

  // Resolve brand_id → brand object (name + color live on the brand row).
  const brandById = (id) => brands.find((b) => b.id === id) || null;

  const open = campaigns.find((c) => c.id === openId);

  const [confirmDel, setConfirmDel] = useState(false);
  const [delState, deleteAction, deleting] = useActionState(deleteCampaign, {});
  useEffect(() => {
    if (delState && delState.deleted) {
      setConfirmDel(false); setView('list'); setOpenId(null); setEditing(null);
    }
  }, [delState]);

  // Rollup from content linked via campaign_id.
  // Rollup from content linked via campaign_id. The live content_items table
  // has no reach/engagement/revenue columns (those live in the performance
  // table), so we report what we truly have: how much content is linked and
  // where it sits in production.
  const rollup = (campId) => {
    const items = content.filter((c) => c.campaign_id === campId);
    return {
      items,
      count: items.length,
      // Treat command_review + in_production together as "being made".
      inProd: items.filter((i) => ['command_review', 'in_production'].includes(i.status)).length,
      review: items.filter((i) => i.status === 'review').length,
      approved: items.filter((i) => i.status === 'approved').length,
    };
  };

  function openDetail(id) { setOpenId(id); setView('detail'); setConfirmDel(false); }
  function openNew() { setEditing(null); setView('form'); }
  function openEdit(c) { setEditing(c); setView('form'); }
  function backToList() { setView('list'); setOpenId(null); setEditing(null); }

  // ----- FORM MODE -----
  if (view === 'form') {
    return <CampaignForm campaign={editing} brands={brands} onDone={backToList} onCancel={backToList} />;
  }

  // ----- DETAIL MODE -----
  if (view === 'detail' && open) {
    const brand = brandById(open.brand_id);
    const brandName = brand?.name || 'Unassigned brand';
    const bc = brand?.color || '#9494AA';
    const st = campStatus(open.status);
    const r = rollup(open.id);
    const field = (label, value) => (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text3)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value || 'Not set'}</div>
      </div>
    );
    return (
      <>
        <div className="ph">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 10, height: 44, borderRadius: 5, flex: '0 0 10px', background: bc }} />
            <div>
              <div className="pt">{open.name}</div>
              <div className="ps">
                <span style={{ color: bc, fontWeight: 600 }}>{brandName}</span>
                {'  ·  '}<span style={{ color: st.color }}>{st.label}</span>
                {'  ·  '}{fmtRange(open.starts_on, open.ends_on)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCommand && <button type="button" className="btn bg" onClick={() => openEdit(open)}>✎ Edit</button>}
            {isCommand && canDelete && !confirmDel && (
              <button type="button" className="btn bg" style={{ color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }} onClick={() => setConfirmDel(true)}>🗑 Delete</button>
            )}
            {isCommand && canDelete && confirmDel && (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#ff6464' }}>Delete campaign?</span>
                <form action={deleteAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={open.id} />
                  <button className="btn" type="submit" disabled={deleting}
                    style={{ background: '#ff6464', color: '#111', borderColor: '#ff6464' }}>
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                </form>
                <button type="button" className="btn bg" onClick={() => setConfirmDel(false)}>Cancel</button>
              </span>
            )}
            <button type="button" className="btn bg" onClick={backToList}>← All campaigns</button>
          </div>
        </div>

        {delState?.error && (
          <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464' }}>
            {delState.error}
          </div>
        )}

        <div className="sgrid" style={{ marginBottom: 18 }}>
          <div className="sc"><div className="slbl">Linked Content</div><div className="sval" style={{ color: bc }}>{r.count}</div><div className="sdlt muted">items</div></div>
          <div className="sc"><div className="slbl">In Production</div><div className="sval" style={{ color: '#ffbb44' }}>{r.inProd}</div><div className="sdlt muted">being made</div></div>
          <div className="sc"><div className="slbl">In Review</div><div className="sval" style={{ color: '#78b8e8' }}>{r.review}</div><div className="sdlt muted">awaiting sign-off</div></div>
          <div className="sc"><div className="slbl">Approved</div><div className="sval" style={{ color: 'var(--green)' }}>{r.approved}</div><div className="sdlt muted">ready</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 18 }}>
          <div className="sc" style={{ padding: 18 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Details</div>
            {field('Goal', open.goal)}
            {field('Brand', brandName)}
            {field('Status', st.label)}
            {field('Timeline', fmtRange(open.starts_on, open.ends_on))}

            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 8, marginTop: 4 }}>Content Pillars</div>
            {(!open.pillars || open.pillars.length === 0) ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                No pillars yet. Edit this campaign to add pillars — each one becomes pickable when you create ideas in Content → Ideas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {open.pillars.map((p, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', borderLeft: `3px solid ${bc}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: p.description ? 4 : 0 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{p.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sc" style={{ padding: 18 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
              Content in this campaign <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {r.count}</span>
            </div>
            {r.count === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                No content linked yet. In the Content Center, set a post&apos;s campaign to <b style={{ color: 'var(--text2)' }}>{open.name}</b> and it will roll up here.
              </div>
            )}
            {r.items.map((i) => {
              const ib = brands.find((b) => b.id === i.brand_id);
              const ic = ib?.color || bc;
              return (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: ic, flex: '0 0 6px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{ib?.name || 'Unassigned'}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', flex: '0 0 auto' }}>
                    {i.status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // ----- LIST MODE -----
  const sorted = [...campaigns].sort((a, b) => {
    const order = { active: 0, planning: 1, done: 2 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Campaigns</div>
          <div className="ps">Every marketing initiative, with its own goal and timeline</div>
        </div>
        {isCommand && <button type="button" className="btn bl" onClick={openNew}>＋ New Campaign</button>}
      </div>

      {campaigns.length === 0 ? (
        <ComingSoon
          icon="◇"
          title="No campaigns yet"
          body={isCommand
            ? 'Create your first campaign to group content with a goal, dates and a brand. Linked content then rolls up here so you can see how a whole initiative performed — not just single posts.'
            : 'No campaigns have been created for your brand yet.'}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {sorted.map((c) => {
            const brand = brandById(c.brand_id);
            const brandName = brand?.name || 'Unassigned';
            const bc = brand?.color || '#9494AA';
            const st = campStatus(c.status);
            const r = rollup(c.id);
            return (
              <div key={c.id} className="sc" style={{ padding: 0, cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={() => openDetail(c.id)}>
                <div style={{ height: 5, background: bc }} />
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{c.name}</div>
                    <span style={{ flex: '0 0 auto', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: st.color, background: st.color + '22', padding: '3px 8px', borderRadius: 20 }}>{st.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: bc, background: bc + '1c', padding: '2px 8px', borderRadius: 5 }}>{brandName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtRange(c.starts_on, c.ends_on)}</span>
                  </div>
                  {c.goal && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.goal}</div>
                  )}
                  <div style={{ display: 'flex', gap: 14, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>Items</div><div style={{ fontSize: 14, fontWeight: 700 }}>{r.count}</div></div>
                    <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>In Prod.</div><div style={{ fontSize: 14, fontWeight: 700 }}>{r.inProd}</div></div>
                    <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>Approved</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{r.approved}</div></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ----- Campaign create / edit form (command only) -----
function CampaignForm({ campaign, brands = [], onDone, onCancel }) {
  const [state, formAction, pending] = useActionState(saveCampaign, {});
  const [status, setStatus] = useState(campaign?.status || 'planning');
  const [brandId, setBrandId] = useState(campaign?.brand_id || (brands[0]?.id || ''));
  const [pillars, setPillars] = useState(
    Array.isArray(campaign?.pillars) && campaign.pillars.length
      ? campaign.pillars.map((p) => ({ name: p.name || '', description: p.description || '' }))
      : []
  );

  useEffect(() => { if (state?.ok) onDone(); }, [state?.ok]);
  const addPillar = () => setPillars((p) => [...p, { name: '', description: '' }]);
  const removePillar = (i) => setPillars((p) => p.filter((_, idx) => idx !== i));
  const updatePillar = (i, key, val) =>
    setPillars((p) => p.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));

  const lbl = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 6, display: 'block' };
  const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: "'Inter',sans-serif" };
  const ta = (h = 80) => ({ ...inp, minHeight: h, resize: 'vertical' });
  const Field = ({ label, children }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">{campaign ? 'Edit campaign' : 'New campaign'}</div>
          <div className="ps">Group content into an initiative with a goal, dates and a brand</div>
        </div>
        <button type="button" className="btn bg" onClick={onCancel}>← Cancel</button>
      </div>

      {state?.error && (
        <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464' }}>
          {state.error}
        </div>
      )}

      <form action={formAction} className="sc" style={{ padding: 22, maxWidth: 680 }}>
        {campaign && <input type="hidden" name="id" value={campaign.id} />}

        <Field label="Campaign name">
          <input style={inp} name="name" defaultValue={campaign?.name || ''} placeholder="e.g. Summer Matcha Drop" />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Brand">
            <select style={inp} name="brand_id" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.length === 0 && <option value="">No brands available</option>}
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select style={inp} name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {CAMP_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Goal">
          <textarea style={ta(70)} name="goal" defaultValue={campaign?.goal || ''} placeholder="What is this initiative trying to achieve? e.g. Drive 500 cafe visits + 2k new followers." />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Start date">
            <input style={inp} type="date" name="starts_on" defaultValue={campaign?.starts_on || ''} />
          </Field>
          <Field label="End date">
            <input style={inp} type="date" name="ends_on" defaultValue={campaign?.ends_on || ''} />
          </Field>
        </div>

        {/* Content Pillars editor — serialized to a hidden JSON field. */}
        <input type="hidden" name="pillars" value={JSON.stringify(pillars.filter((p) => (p.name || '').trim()))} />
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Content Pillars</label>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>
            Define the themes this campaign produces against. Each pillar becomes selectable when you create ideas in Content → Ideas.
          </div>
          {pillars.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '10px 0' }}>No pillars yet.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pillars.map((p, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 8, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    style={{ ...inp, fontWeight: 600 }}
                    value={p.name}
                    onChange={(e) => updatePillar(i, 'name', e.target.value)}
                    placeholder={`Pillar ${i + 1} name — e.g. Matcha Education`}
                  />
                  <button
                    type="button"
                    className="btn bg"
                    onClick={() => removePillar(i)}
                    style={{ flex: '0 0 auto', color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }}
                  >🗑</button>
                </div>
                <textarea
                  style={ta(60)}
                  value={p.description}
                  onChange={(e) => updatePillar(i, 'description', e.target.value)}
                  placeholder="Explain this pillar well — what it covers, the angle, why it matters, example topics."
                />
              </div>
            ))}
          </div>
          <button type="button" className="btn bg" onClick={addPillar} style={{ marginTop: 10 }}>
            ＋ Add pillar
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className={`btn bl ${pending ? 'loading' : ''}`} type="submit" disabled={pending}>
            {pending ? 'Saving…' : campaign ? 'Save changes' : 'Create campaign'}
          </button>
          <button className="btn bg" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
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
function ComingSoon({ icon, title, body, actionLabel, onAction }) {
  return (
    <div className="soon-card">
      <div className="soon-ic">{icon}</div>
      <div className="soon-t">{title}</div>
      <div className="soon-b">{body}</div>
      {actionLabel && onAction ? (
        <button type="button" className="btn bl" onClick={onAction} style={{ marginTop: 16 }}>{actionLabel}</button>
      ) : (
        <div className="soon-tag">Coming in next build</div>
      )}
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
function BrandCenter({ brands, isCommand, canDelete = true, content }) {
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
    const items = content.filter((c) => c.brand_id === open.id);
    const field = (label, value) => (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text3)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value || 'Not set'}</div>
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
            {isCommand && <button type="button" className="btn bg" onClick={() => openEdit(open)}>✎ Edit</button>}
            {isCommand && canDelete && !confirmDel && (
              <button type="button" className="btn bg" style={{ color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }} onClick={() => setConfirmDel(true)}>🗑 Delete</button>
            )}
            {isCommand && canDelete && confirmDel && (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#ff6464' }}>Delete permanently?</span>
                <form action={deleteAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={open.id} />
                  <button className="btn" type="submit" disabled={deleting}
                    style={{ background: '#ff6464', color: '#111', borderColor: '#ff6464' }}>
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                </form>
                <button type="button" className="btn bg" onClick={() => setConfirmDel(false)}>Cancel</button>
              </span>
            )}
            <button type="button" className="btn bg" onClick={backToList}>← All brands</button>
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
          const labelFor = (k) => k === 'black' ? 'Black' : k === 'white' ? 'White' : k.toUpperCase();
          return (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="ch"><div className="ct">Palette & References</div></div>
              <div className="cb">
                {palEntries.length === 0 && gal.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>No palette colors or reference images yet.</div>
                )}
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

        {/* Extended brand profile sections (from brand_book).
            Read-only view of the full Brand Brain — every section and field
            always shows, even when empty, so non-command users (e.g. Tali)
            can see the complete structure. Empty fields render "Not set". */}
        {(() => {
          const bb = open.brand_book || {};
          const sec = (label, value) => {
            const filled = value && value.trim();
            return (
              <div style={{ marginBottom: 14 }} key={label}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: filled ? 'var(--text)' : 'var(--text3)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{filled ? value : 'Not set'}</div>
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
          return groups.map(([title, rows]) => (
            <div className="card" style={{ marginBottom: 18 }} key={title}>
              <div className="ch"><div className="ct">{title}</div></div>
              <div className="cb">{rows.map(([l, v]) => sec(l, v))}</div>
            </div>
          ));
        })()}

        {/* Visual Assets (attachments from the Visual tab) */}
        {(() => {
          const bb = open.brand_book || {};
          const sgPdf = bb.style_guide_pdf;
          const logoImgs = bb.logo_images || [];
          const fonts = bb.font_files || [];
          const covers = bb.cover_templates || [];
          const vrefs = bb.video_refs || [];
          const photos = bb.photo_images || {};
          const pkgImgs = bb.packaging_images || [];
          const photoCats = Object.entries(photos).filter(([, arr]) => (arr || []).length);
          const hasAny = sgPdf || logoImgs.length || fonts.length || covers.length || vrefs.length || photoCats.length || pkgImgs.length;
          const subhead = (t) => <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 8 }}>{t}</div>;
          const thumbs = (arr) => (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {arr.map((it, i) => (
                <a key={i} href={it.url} target="_blank" rel="noreferrer" style={{ display: 'block', width: 110, height: 88, borderRadius: 9, background: `center/cover no-repeat url(${it.url})`, border: '1px solid var(--border)' }} />
              ))}
            </div>
          );
          const linkRow = (arr, icon) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {arr.map((it, i) => (
                <a key={i} href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{icon} {it.name || it.url}</a>
              ))}
            </div>
          );
          return (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="ch"><div className="ct">Visual Assets</div></div>
              <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {!hasAny && <div style={{ fontSize: 12, color: 'var(--text3)' }}>No files uploaded yet.</div>}
                {sgPdf && <div>{subhead('Style Guideline PDF')}{linkRow([sgPdf], '📄')}</div>}
                {logoImgs.length > 0 && <div>{subhead('Logo Files')}{thumbs(logoImgs)}</div>}
                {fonts.length > 0 && <div>{subhead('Font Files')}{linkRow(fonts, '🔤')}</div>}
                {photoCats.length > 0 && (
                  <div>
                    {subhead('Photography References')}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {photoCats.map(([cat, arr]) => (
                        <div key={cat}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 6 }}>{cat}</div>
                          {thumbs(arr)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {covers.length > 0 && <div>{subhead('Cover Templates')}{thumbs(covers)}</div>}
                {vrefs.length > 0 && <div>{subhead('Video References')}{linkRow(vrefs, '🔗')}</div>}
                {pkgImgs.length > 0 && <div>{subhead('Visual & Packaging')}{thumbs(pkgImgs)}</div>}
              </div>
            </div>
          );
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
                {!hasAny && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{isCommand ? 'Not configured yet — click Edit to set caption structure, CTAs, hashtags & vocabulary.' : 'Not configured yet.'}</div>}
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
        {isCommand && <button type="button" className="btn bl" onClick={openNew}>＋ Add Brand</button>}
      </div>

      <div className="bgrid">
        {brands.map((b) => {
          const items = content.filter((c) => c.brand_id === b.id);
          return (
            <div className="bcard" key={b.id} onClick={() => openDetail(b.id)}>
              <div className="bc-hd">
                <div className="bc-av" style={{ background: b.brand_book?.icon_url ? `center/cover no-repeat url(${b.brand_book.icon_url})` : b.color + '22', color: b.color, overflow: 'hidden' }}>
                  {!b.brand_book?.icon_url && (b.name || '?').slice(0, 2).toUpperCase()}
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

  // ---- New Visual attachments (all stored in brand_book) ----
  const PHOTO_CATS = ['Exterior', 'Interior', 'Drink', 'Food', 'Barista'];
  const [styleGuidePdf, setStyleGuidePdf] = useState(() => bb.style_guide_pdf || null); // {url,name}
  const [logoImages, setLogoImages] = useState(() => bb.logo_images || []);             // [{url}]
  const [fontFiles, setFontFiles] = useState(() => bb.font_files || []);                // [{url,name}]
  const [coverTemplates, setCoverTemplates] = useState(() => bb.cover_templates || []); // [{url}]
  const [videoRefs, setVideoRefs] = useState(() => bb.video_refs || []);                // [{url}]
  const [videoRefInput, setVideoRefInput] = useState('');
  const [photoImages, setPhotoImages] = useState(() => bb.photo_images || {});          // {cat:[{url}]}
  const [packagingImages, setPackagingImages] = useState(() => bb.packaging_images || []); // [{url}]
  const [busy, setBusy] = useState('');

  // Generic uploader → brand-assets bucket. Returns [{url,name}].
  async function uploadToAssets(files) {
    const supabase = createBrowserClient();
    const out = [];
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${(brand?.id || 'new')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('brand-assets').getPublicUrl(path);
      out.push({ url: data.publicUrl, name: file.name });
    }
    return out;
  }
  async function withBusy(key, fn) {
    setUploadErr(''); setBusy(key);
    try { await fn(); } catch (err) { setUploadErr(err.message || 'Upload failed.'); }
    finally { setBusy(''); }
  }
  function addVideoRef() {
    const v = videoRefInput.trim();
    if (!v) return;
    setVideoRefs((r) => [...r, { url: v }]);
    setVideoRefInput('');
  }

  // ---- Render helpers for attachments ----
  const ImageGrid = ({ items, onRemove, addLabel, busyKey, onPick, accept = 'image/*', multiple = true }) => (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
      {(items || []).map((it, i) => (
        <div key={i} style={{ position: 'relative', width: 100 }}>
          <div style={{ width: 100, height: 80, borderRadius: 8, background: `center/cover no-repeat url(${it.url})`, border: '1px solid var(--border)' }} />
          <button type="button" onClick={() => onRemove(i)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11 }}>×</button>
        </div>
      ))}
      <label className="btn bg" style={{ cursor: 'pointer', width: 100, height: 80, display: 'grid', placeItems: 'center', borderStyle: 'dashed', fontSize: 11, textAlign: 'center', padding: 4 }}>
        {busy === busyKey ? 'Uploading…' : addLabel}
        <input type="file" accept={accept} multiple={multiple} onChange={onPick} style={{ display: 'none' }} />
      </label>
    </div>
  );
  const FileList = ({ items, onRemove }) => (
    (items || []).length ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
            <a href={it.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {it.name || it.url}</a>
            <button type="button" onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        ))}
      </div>
    ) : null
  );

  useEffect(() => { if (state?.ok) onDone(); }, [state?.ok]);

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
        <button type="button" className="btn bg" onClick={onCancel}>← Cancel</button>
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
        <input type="hidden" name="style_guide_pdf" value={JSON.stringify(styleGuidePdf)} />
        <input type="hidden" name="logo_images" value={JSON.stringify(logoImages)} />
        <input type="hidden" name="font_files" value={JSON.stringify(fontFiles)} />
        <input type="hidden" name="cover_templates" value={JSON.stringify(coverTemplates)} />
        <input type="hidden" name="video_refs" value={JSON.stringify(videoRefs)} />
        <input type="hidden" name="photo_images" value={JSON.stringify(photoImages)} />
        <input type="hidden" name="packaging_images" value={JSON.stringify(packagingImages)} />

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
        <div style={{ display: tab === 'identity' ? 'block' : 'none' }}>
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
        </div>

        {/* ---------------- VISUAL ---------------- */}
        <div style={{ display: tab === 'visual' ? 'block' : 'none' }}>
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

            {/* STYLE GUIDELINES — text + PDF */}
            <Field label="Style Guidelines" sub="Write the rules and/or attach the full guideline PDF.">
              <textarea style={ta(90)} name="style_guide" defaultValue={brand?.style_guide || ''} placeholder="Visual rules — colors, type, imagery, do’s and don’ts." />
              {styleGuidePdf ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
                  <a href={styleGuidePdf.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: 'var(--text)', textDecoration: 'none' }}>📄 {styleGuidePdf.name}</a>
                  <button type="button" onClick={() => setStyleGuidePdf(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ) : (
                <label className="btn bg bsm" style={{ cursor: 'pointer', marginTop: 8, display: 'inline-block' }}>
                  {busy === 'sg' ? 'Uploading…' : '📄 Attach PDF'}
                  <input type="file" accept="application/pdf,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) withBusy('sg', async () => { const [up] = await uploadToAssets([f]); setStyleGuidePdf(up); }); }} style={{ display: 'none' }} />
                </label>
              )}
            </Field>

            {/* LOGO RULES — text + images */}
            <Field label="Logo Rules" sub="Clear space, minimum size, what not to do. Attach logo files / lockups.">
              <textarea style={ta(80)} name="logo_rules" defaultValue={bb.logo_rules || ''} placeholder="How the logo should and shouldn't be used." />
              <ImageGrid items={logoImages} busyKey="logo" addLabel="＋ Add logo"
                onRemove={(i) => setLogoImages((a) => a.filter((_, x) => x !== i))}
                onPick={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) withBusy('logo', async () => { const up = await uploadToAssets(fs); setLogoImages((a) => [...a, ...up.map(({ url }) => ({ url }))]); }); }} />
            </Field>

            {/* TYPOGRAPHY — text + font files */}
            <Field label="Typography" sub="Fonts, weights, hierarchy. Attach the actual font files (.ttf, .otf, .woff).">
              <textarea style={ta(80)} name="typography" defaultValue={bb.typography || ''} placeholder="Headline font, body font, when to use each." />
              <FileList items={fontFiles} onRemove={(i) => setFontFiles((a) => a.filter((_, x) => x !== i))} />
              <label className="btn bg bsm" style={{ cursor: 'pointer', marginTop: 8, display: 'inline-block' }}>
                {busy === 'fonts' ? 'Uploading…' : '🔤 Add font files'}
                <input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" multiple onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) withBusy('fonts', async () => { const up = await uploadToAssets(fs); setFontFiles((a) => [...a, ...up]); }); }} style={{ display: 'none' }} />
              </label>
            </Field>

            {/* PHOTOGRAPHY DIRECTION — text + categorized images */}
            <Field label="Photography Direction" sub="Lighting, mood, composition. Attach reference shots per category.">
              <textarea style={ta(80)} name="photo_direction" defaultValue={bb.photo_direction || ''} placeholder="Lighting, mood, composition, color grading." />
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {PHOTO_CATS.map((cat) => (
                  <div key={cat}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text2)' }}>{cat}</div>
                    <ImageGrid items={photoImages[cat]} busyKey={`photo-${cat}`} addLabel={`＋ ${cat}`}
                      onRemove={(i) => setPhotoImages((m) => ({ ...m, [cat]: (m[cat] || []).filter((_, x) => x !== i) }))}
                      onPick={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) withBusy(`photo-${cat}`, async () => { const up = await uploadToAssets(fs); setPhotoImages((m) => ({ ...m, [cat]: [...(m[cat] || []), ...up.map(({ url }) => ({ url }))] })); }); }} />
                  </div>
                ))}
              </div>
            </Field>

            {/* VIDEO DIRECTION — text + cover templates + reference links */}
            <Field label="Video Direction" sub="Pacing, music, captions, format per platform.">
              <textarea style={ta(80)} name="video_direction" defaultValue={bb.video_direction || ''} placeholder="Pacing, music, captions, format per platform." />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text2)' }}>Cover Templates</div>
                <ImageGrid items={coverTemplates} busyKey="cover" addLabel="＋ Add cover"
                  onRemove={(i) => setCoverTemplates((a) => a.filter((_, x) => x !== i))}
                  onPick={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) withBusy('cover', async () => { const up = await uploadToAssets(fs); setCoverTemplates((a) => [...a, ...up.map(({ url }) => ({ url }))]); }); }} />
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 6 }}>Video References</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={videoRefInput} onChange={(e) => setVideoRefInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVideoRef(); } }} placeholder="Paste a link (YouTube, IG, Drive…)" style={inp} />
                  <button type="button" className="btn bg" onClick={addVideoRef}>Add</button>
                </div>
                <FileList items={videoRefs} onRemove={(i) => setVideoRefs((a) => a.filter((_, x) => x !== i))} />
              </div>
            </Field>

            {/* VISUAL & PACKAGING — text + images */}
            <Field label="Visual & Packaging Notes" sub="Cup design, labels, stickers, print standards. Attach images.">
              <textarea style={ta(80)} name="packaging" defaultValue={bb.packaging || ''} placeholder="Cup design, labels, stickers, print standards." />
              <ImageGrid items={packagingImages} busyKey="pkg" addLabel="＋ Add image"
                onRemove={(i) => setPackagingImages((a) => a.filter((_, x) => x !== i))}
                onPick={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) withBusy('pkg', async () => { const up = await uploadToAssets(fs); setPackagingImages((a) => [...a, ...up.map(({ url }) => ({ url }))]); }); }} />
            </Field>

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
        </div>

        {/* ---------------- CONTENT ---------------- */}
        <div style={{ display: tab === 'content' ? 'block' : 'none' }}>
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
        </div>

        {/* ---------------- LEGAL ---------------- */}
        <div style={{ display: tab === 'legal' ? 'block' : 'none' }}>
          <div className="card" style={{ padding: 22 }}>
            <Field label="Legal Claims & Compliance" sub="Claims you can/can't make, required disclaimers, regulated language."><textarea style={ta(140)} name="legal_compliance" defaultValue={bb.legal_compliance || ''} placeholder={'Approved claims, banned claims, allergen notes, promo T&Cs.'} /></Field>
          </div>
        </div>

        {/* ---------------- AI ---------------- */}
        <div style={{ display: tab === 'ai' ? 'block' : 'none' }}>
          <div className="card" style={{ padding: 22 }}>
            <Field label="AI Prompt Examples" sub="Good prompts for generating on-brand content — the Strategist can reuse these."><textarea style={ta(160)} name="ai_prompts" defaultValue={bb.ai_prompts || ''} placeholder={'"Write a warm, short IG caption for a new seasonal drink, 1 emoji max…"'} /></Field>
          </div>
        </div>

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

// Content pipeline: Content Bucket -> Ideas -> Production (-> Assets, later).
// Driven by subView ('bucket' | 'ideas' | 'production' | 'assets'); defaults
// to bucket. Briefs has been retired — ideas carry full brief-level detail.
// All wired to the REAL schema:
//   ideas(brand_id, campaign_id, title, notes, status new|approved|archived,
//         ready, pillar, channel, format, hook, caption, hashtags,
//         mandatories, publish_date, production_due, edit_due)
//   content_items(brand_id, idea_id, campaign_id, title, body,
//                 status command_review|in_production|review|approved)
function ContentCenter({ content, ideas = [], brands = [], campaigns = [], assets = [], isCommand, canDelete = true, brandColor, subView, googleConnected = false }) {
  const tab = ['bucket', 'ideas', 'production', 'assets'].includes(subView) ? subView : 'bucket';
  const brandById = (id) => brands.find((b) => b.id === id) || null;

  if (tab === 'bucket') return <ContentBucketView ideas={ideas} brands={brands} campaigns={campaigns} brandById={brandById} isCommand={isCommand} />;
  if (tab === 'ideas') return <IdeasView ideas={ideas} content={content} brands={brands} campaigns={campaigns} brandById={brandById} isCommand={isCommand} />;
  if (tab === 'assets') return <AssetLibrary assets={assets} content={content} ideas={ideas} brands={brands} brandColor={brandColor} isCommand={isCommand} />;
  return <ProductionView content={content} ideas={ideas} brands={brands} campaigns={campaigns} brandById={brandById} isCommand={isCommand} canDelete={canDelete} googleConnected={googleConnected} />;
}

// =====================================================================
// MARKETING COLLATERALS — independent from the social pipeline above.
// THEME (mc_themes) works exactly like Campaigns: a brand-scoped
// initiative with a goal, dates, status, and pillars. Line Up items
// (mc_items) can be tagged to a theme, and roll up here the same way
// content rolls up to a campaign.
// =====================================================================
const MC_THEME_STATUS = {
  planning: { label: 'Planning', color: '#9494AA' },
  active: { label: 'Active', color: '#64BC46' },
  done: { label: 'Done', color: '#78b8e8' },
};
const mcThemeStatus = (s) => MC_THEME_STATUS[s] || MC_THEME_STATUS.planning;

function ThemeCenter({ mcThemes = [], mcItems = [], brands = [], isCommand }) {
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'form'
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const brandById = (id) => brands.find((b) => b.id === id) || null;
  const open = mcThemes.find((t) => t.id === openId);

  const [delState, deleteAction, deleting] = useActionState(deleteTheme, {});
  useEffect(() => {
    if (delState && delState.deleted) { setConfirmDel(false); setView('list'); setOpenId(null); setEditing(null); }
  }, [delState]);

  const rollup = (themeId) => {
    const items = mcItems.filter((i) => i.theme_id === themeId);
    return {
      items,
      count: items.length,
      inAssembly: items.filter((i) => i.status === 'in_assembly').length,
      review: items.filter((i) => i.status === 'review').length,
      approved: items.filter((i) => i.status === 'approved').length,
    };
  };

  function openDetail(id) { setOpenId(id); setView('detail'); setConfirmDel(false); }
  function openNew() { setEditing(null); setView('form'); }
  function openEdit(t) { setEditing(t); setView('form'); }
  function backToList() { setView('list'); setOpenId(null); setEditing(null); }

  if (view === 'form') {
    return <ThemeForm theme={editing} brands={brands} onDone={backToList} onCancel={backToList} />;
  }

  if (view === 'detail' && open) {
    const brand = brandById(open.brand_id);
    const brandName = brand?.name || 'Unassigned brand';
    const bc = brand?.color || '#9494AA';
    const st = mcThemeStatus(open.status);
    const r = rollup(open.id);
    const field = (label, value) => (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text3)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{value || 'Not set'}</div>
      </div>
    );
    return (
      <>
        <div className="ph">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 10, height: 44, borderRadius: 5, flex: '0 0 10px', background: bc }} />
            <div>
              <div className="pt">{open.name}</div>
              <div className="ps">
                <span style={{ color: bc, fontWeight: 600 }}>{brandName}</span>
                {'  ·  '}<span style={{ color: st.color }}>{st.label}</span>
                {'  ·  '}{fmtRange(open.starts_on, open.ends_on)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCommand && <button type="button" className="btn bg" onClick={() => openEdit(open)}>✎ Edit</button>}
            {isCommand && !confirmDel && (
              <button type="button" className="btn bg" style={{ color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }} onClick={() => setConfirmDel(true)}>🗑 Delete</button>
            )}
            {isCommand && confirmDel && (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#ff6464' }}>Delete theme?</span>
                <form action={deleteAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={open.id} />
                  <button className="btn" type="submit" disabled={deleting} style={{ background: '#ff6464', color: '#111', borderColor: '#ff6464' }}>{deleting ? 'Deleting…' : 'Yes, delete'}</button>
                </form>
                <button type="button" className="btn bg" onClick={() => setConfirmDel(false)}>Cancel</button>
              </span>
            )}
            <button type="button" className="btn bg" onClick={backToList}>← All themes</button>
          </div>
        </div>

        {delState?.error && <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464' }}>{delState.error}</div>}

        <div className="sgrid" style={{ marginBottom: 18 }}>
          <div className="sc"><div className="slbl">Line Up items</div><div className="sval" style={{ color: bc }}>{r.count}</div><div className="sdlt muted">total</div></div>
          <div className="sc"><div className="slbl">In Assembly</div><div className="sval" style={{ color: '#ffbb44' }}>{r.inAssembly}</div><div className="sdlt muted">being made</div></div>
          <div className="sc"><div className="slbl">In Review</div><div className="sval" style={{ color: '#78b8e8' }}>{r.review}</div><div className="sdlt muted">awaiting sign-off</div></div>
          <div className="sc"><div className="slbl">Approved</div><div className="sval" style={{ color: 'var(--green)' }}>{r.approved}</div><div className="sdlt muted">ready</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 18 }}>
          <div className="sc" style={{ padding: 18 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Details</div>
            {field('Goal', open.goal)}
            {field('Brand', brandName)}
            {field('Status', st.label)}
            {field('Timeline', fmtRange(open.starts_on, open.ends_on))}

            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 8, marginTop: 4 }}>Pillars</div>
            {(!open.pillars || open.pillars.length === 0) ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                No pillars yet. Edit this theme to add pillars — each one becomes pickable when you add rows in Line Up.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {open.pillars.map((p, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg3)', borderLeft: `3px solid ${bc}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: p.description ? 4 : 0 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{p.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sc" style={{ padding: 18 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 14 }}>
              Line Up items in this theme <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {r.count}</span>
            </div>
            {r.count === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                No items linked yet. In Line Up, set a row&apos;s Theme to <b style={{ color: 'var(--text2)' }}>{open.name}</b> and it will roll up here.
              </div>
            )}
            {r.items.map((i) => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: bc, flex: '0 0 6px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.title}</div>
                  {i.kind && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{i.kind}</div>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', flex: '0 0 auto' }}>{i.status}</div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ----- LIST MODE -----
  const sorted = [...mcThemes].sort((a, b) => {
    const order = { active: 0, planning: 1, done: 2 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Theme</div>
          <div className="ps">Marketing Collateral initiatives — like Campaigns, but for physical materials</div>
        </div>
        {isCommand && <button type="button" className="btn bl" onClick={openNew}>＋ New Theme</button>}
      </div>

      {mcThemes.length === 0 ? (
        <ComingSoon
          icon="◇"
          title="No themes yet"
          body={isCommand
            ? 'Create your first theme to group collateral with a goal, dates and a brand — e.g. a seasonal collection or a store refresh. Line Up items tagged to it roll up here.'
            : 'No themes have been created for your brand yet.'}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {sorted.map((t) => {
            const brand = brandById(t.brand_id);
            const brandName = brand?.name || 'Unassigned';
            const bc = brand?.color || '#9494AA';
            const st = mcThemeStatus(t.status);
            const r = rollup(t.id);
            return (
              <div key={t.id} className="sc" style={{ padding: 0, cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={() => openDetail(t.id)}>
                <div style={{ height: 5, background: bc }} />
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{t.name}</div>
                    <span style={{ flex: '0 0 auto', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: st.color, background: st.color + '22', padding: '3px 8px', borderRadius: 20 }}>{st.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: bc, background: bc + '1c', padding: '2px 8px', borderRadius: 5 }}>{brandName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtRange(t.starts_on, t.ends_on)}</span>
                  </div>
                  {t.goal && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.goal}</div>
                  )}
                  <div style={{ display: 'flex', gap: 14, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>Items</div><div style={{ fontSize: 14, fontWeight: 700 }}>{r.count}</div></div>
                    <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>Assembly</div><div style={{ fontSize: 14, fontWeight: 700 }}>{r.inAssembly}</div></div>
                    <div><div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>Approved</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{r.approved}</div></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ThemeForm({ theme, brands = [], onDone, onCancel }) {
  const [state, formAction, pending] = useActionState(saveTheme, {});
  const [status, setStatus] = useState(theme?.status || 'planning');
  const [brandId, setBrandId] = useState(theme?.brand_id || (brands[0]?.id || ''));
  const [pillars, setPillars] = useState(
    Array.isArray(theme?.pillars) && theme.pillars.length
      ? theme.pillars.map((p) => ({ name: p.name || '', description: p.description || '' }))
      : []
  );

  useEffect(() => { if (state?.ok) onDone(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [state]);

  function addPillar() { setPillars((p) => [...p, { name: '', description: '' }]); }
  function updatePillar(idx, key, val) { setPillars((p) => p.map((x, i) => (i === idx ? { ...x, [key]: val } : x))); }
  function removePillar(idx) { setPillars((p) => p.filter((_, i) => i !== idx)); }

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">{theme ? 'Edit Theme' : 'New Theme'}</div>
          <div className="ps">Theme · Marketing Collaterals</div>
        </div>
        <button type="button" className="btn bg" onClick={onCancel}>← Back</button>
      </div>

      <form action={formAction} className="sc" style={{ padding: 20, maxWidth: 640 }}>
        {theme && <input type="hidden" name="id" value={theme.id} />}
        <input type="hidden" name="pillars" value={JSON.stringify(pillars.filter((p) => p.name.trim()))} />

        {state?.error && <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464', marginBottom: 14 }}>{state.error}</div>}

        <CField label="Brand">
          <select name="brand_id" value={brandId} onChange={(e) => setBrandId(e.target.value)} style={cInp} required>
            <option value="" disabled>Select a brand…</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </CField>

        <CField label="Theme name">
          <input type="text" name="name" defaultValue={theme?.name || ''} style={cInp} placeholder="e.g. Holiday Collection 2026" required />
        </CField>

        <CField label="Goal">
          <textarea name="goal" defaultValue={theme?.goal || ''} style={cTa(80)} placeholder="What is this collateral push trying to achieve?" />
        </CField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <CField label="Status">
            <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} style={cInp}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="done">Done</option>
            </select>
          </CField>
          <CField label="Starts"><input type="date" name="starts_on" defaultValue={theme?.starts_on || ''} style={cInp} /></CField>
          <CField label="Ends"><input type="date" name="ends_on" defaultValue={theme?.ends_on || ''} style={cInp} /></CField>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={cLbl}>Pillars <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional — become pickable on Line Up rows)</span></label>
          {pillars.map((p, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input style={{ ...cInp, flex: '0 0 40%' }} value={p.name} onChange={(e) => updatePillar(idx, 'name', e.target.value)} placeholder="Pillar name" />
              <input style={{ ...cInp, flex: 1 }} value={p.description} onChange={(e) => updatePillar(idx, 'description', e.target.value)} placeholder="Description (optional)" />
              <button type="button" className="btn bg" onClick={() => removePillar(idx)} style={{ flex: '0 0 auto', color: '#ff6464' }}>✕</button>
            </div>
          ))}
          <button type="button" className="btn bg" onClick={addPillar} style={{ fontSize: 12 }}>＋ Add pillar</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button className="btn bl" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save Theme'}</button>
          <button type="button" className="btn bg" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </>
  );
}

// Shared form atoms.
const cLbl = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 6, display: 'block' };
const cInp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: "'Inter',sans-serif" };
const cTa = (h = 80) => ({ ...cInp, minHeight: h, resize: 'vertical' });
function CField({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={cLbl}>{label}</label>{children}</div>;
}
function Pill({ text, color }) {
  return <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color, background: color + '22', padding: '3px 8px', borderRadius: 20 }}>{text}</span>;
}
// Notion-style row popup — overlays whatever list/table/board is underneath
// instead of replacing the whole page, so clicking a row to view or edit it
// never loses your scroll position or filters. Click the backdrop or ✕ to
// close; clicks inside the panel don't bubble up and close it accidentally.
function Modal({ title, subtitle, onClose, children, maxWidth = 640 }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,14,.7)', backdropFilter: 'blur(2px)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 20px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} className="sc" style={{ width: '100%', maxWidth, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button type="button" className="btn bg" onClick={onClose} style={{ fontSize: 12, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}
const STATUS_COLOR = {
  new: '#9494AA', draft: '#9494AA',
  approved: '#64BC46',
  archived: '#6a6a7a',
  command_review: '#EE268C', in_production: '#ffbb44', review: '#78b8e8',
};

// =====================================================================
// ASSET LIBRARY — browse, upload & manage finished files per brand.
// Reads public.assets (id, brand_id, content_id, storage_path, kind).
// Files live in the 'brand-assets' Storage bucket; storage_path is the
// object key. Upload happens on the client (same pattern as the Brand
// form), then saveAsset() records the row through the user's session so
// RLS decides who can write.
// =====================================================================
const ASSET_BUCKET = 'brand-assets';
const KIND_META = {
  image: { label: 'Images', icon: '🖼', color: '#EE268C' },
  video: { label: 'Videos', icon: '🎬', color: '#64BC46' },
  doc: { label: 'Docs', icon: '📄', color: '#AED8FF' },
};

function kindFromFile(file) {
  const name = file.name || '';
  const mime = file.type || '';
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'heic'].includes(ext)) return 'image';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(ext)) return 'video';
  return 'doc';
}

function AssetLibrary({ assets = [], content = [], ideas = [], brands = [], brandColor, isCommand }) {
  const [brandFilter, setBrandFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [fmtTab, setFmtTab] = useState({}); // { [channel]: activeFormat }

  const [saveState, saveAction] = useActionState(saveAsset, {});
  const [delState, deleteAction] = useActionState(deleteAsset, {});

  const brandById = (id) => brands.find((b) => b.id === id) || null;
  const ideaById = (id) => ideas.find((i) => i.id === id) || null;
  const colorFor = (id) => {
    const b = brandById(id);
    return (b && b.color) || (b && brandColor ? brandColor(b.name) : '#9494AA');
  };

  // Resolve a public URL for an object key in the bucket.
  function publicUrl(storage_path) {
    if (!storage_path) return '';
    if (/^https?:\/\//.test(storage_path)) return storage_path; // tolerate full URLs
    const supabase = createBrowserClient();
    const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(storage_path);
    return data.publicUrl;
  }

  // Channel + format for a content item, inherited from its linked idea.
  function chFmt(contentItem) {
    const idea = contentItem?.idea_id ? ideaById(contentItem.idea_id) : null;
    return {
      channel: (idea?.channel || '').trim() || 'Unsorted',
      format: (idea?.format || '').trim() || 'General',
    };
  }

  // Build one unified list of "asset entries" from two sources:
  //  (a) uploaded files in the assets table  (image | video | doc)
  //  (b) Google Drive links attached on content items (kind: 'link')
  // Each entry: { key, kind, brand_id, url, name, channel, format, contentTitle, assetRow? }
  const entries = [];

  // (a) uploaded assets — channel/format from their linked content's brief.
  for (const a of assets) {
    const ci = content.find((c) => c.id === a.content_id);
    const { channel, format } = ci ? chFmt(ci) : { channel: 'Unsorted', format: 'General' };
    entries.push({
      key: `asset-${a.id}`,
      kind: a.kind || 'doc',
      brand_id: a.brand_id,
      url: publicUrl(a.storage_path),
      name: (a.storage_path || '').split('/').pop() || 'file',
      channel, format,
      contentTitle: ci?.title || null,
      assetRow: a,
    });
  }

  // (b) Drive links collated from Production attachments.
  for (const ci of content) {
    const list = Array.isArray(ci.attachments) ? ci.attachments : [];
    const { channel, format } = chFmt(ci);
    list.forEach((att, i) => {
      if (!att?.url) return;
      entries.push({
        key: `link-${ci.id}-${i}`,
        kind: 'link',
        brand_id: ci.brand_id,
        url: att.url,
        name: att.name || att.url,
        channel, format,
        contentTitle: ci.title || null,
        assetRow: null, // links are managed on the Production card, not deletable here
      });
    });
  }

  // Upload selected files to Storage, then record each as an assets row.
  async function handleUpload(fileList) {
    setUploadErr('');
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let targetBrand = brandFilter !== 'all' ? brandFilter : (brands.length === 1 ? brands[0].id : '');
    if (!targetBrand) {
      setUploadErr('Pick a brand tab first, then upload — so each file is tagged to the right brand.');
      return;
    }
    setUploading(true);
    try {
      const supabase = createBrowserClient();
      for (const file of files) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const key = `${targetBrand}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await supabase.storage.from(ASSET_BUCKET).upload(key, file, { upsert: true });
        if (error) throw error;
        const fd = new FormData();
        fd.set('brand_id', targetBrand);
        fd.set('storage_path', key);
        fd.set('kind', kindFromFile(file));
        saveAction(fd);
      }
    } catch (err) {
      setUploadErr(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function removeAsset(asset) {
    const fd = new FormData();
    fd.set('id', asset.id);
    fd.set('storage_path', asset.storage_path || '');
    deleteAction(fd);
    setConfirmId(null);
  }

  // Counts (across the unified list) for the kind chips.
  const counts = {
    all: entries.length,
    image: entries.filter((e) => e.kind === 'image').length,
    video: entries.filter((e) => e.kind === 'video').length,
    doc: entries.filter((e) => e.kind === 'doc').length,
    link: entries.filter((e) => e.kind === 'link').length,
  };

  // Apply brand + kind filters.
  const filtered = entries.filter((e) => {
    if (brandFilter !== 'all' && e.brand_id !== brandFilter) return false;
    if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
    return true;
  });

  // Group by Channel → Format.
  const byChannel = {};
  for (const e of filtered) {
    (byChannel[e.channel] ||= {});
    (byChannel[e.channel][e.format] ||= []).push(e);
  }
  // Channel order: canonical CHANNELS order first, then any extras alpha, Unsorted last.
  const channelKeys = Object.keys(byChannel).sort((a, b) => {
    if (a === 'Unsorted') return 1;
    if (b === 'Unsorted') return -1;
    const ia = CHANNELS.indexOf(a), ib = CHANNELS.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Assets</div>
          <div className="ps">Every finished file and submitted Drive link in one library — grouped by channel and format, filterable by brand and type.</div>
        </div>
        {isCommand && (
          <label className="btn bl" style={{ cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Uploading…' : '＋ Upload assets'}
            <input
              type="file"
              multiple
              accept="image/*,video/*,application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.zip"
              onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
              style={{ display: 'none' }}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {uploadErr && <div style={{ fontSize: 12, color: '#ff6464', marginBottom: 12 }}>{uploadErr}</div>}
      {saveState?.error && <div style={{ fontSize: 12, color: '#ff6464', marginBottom: 12 }}>{saveState.error}</div>}
      {delState?.error && <div style={{ fontSize: 12, color: '#ff6464', marginBottom: 12 }}>{delState.error}</div>}

      {/* Brand filter chips */}
      {brands.length > 1 && (
        <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 10 }}>
          <div className={`cvw ${brandFilter === 'all' ? 'on' : ''}`} onClick={() => setBrandFilter('all')}>All brands</div>
          {brands.map((b) => {
            const on = brandFilter === b.id;
            const c = b.color || (brandColor ? brandColor(b.name) : '#9494AA');
            return (
              <div key={b.id} className={`cvw ${on ? 'on' : ''}`} onClick={() => setBrandFilter(b.id)}
                style={on ? { color: c, background: c + '22' } : { color: c }}>
                {b.name}
              </div>
            );
          })}
        </div>
      )}

      {/* Kind filter chips */}
      <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 16 }}>
        <div className={`cvw ${kindFilter === 'all' ? 'on' : ''}`} onClick={() => setKindFilter('all')}>All ({counts.all})</div>
        {Object.entries(KIND_META).map(([k, meta]) => {
          const on = kindFilter === k;
          return (
            <div key={k} className={`cvw ${on ? 'on' : ''}`} onClick={() => setKindFilter(k)}
              style={on ? { color: meta.color, background: meta.color + '22' } : { color: meta.color }}>
              {meta.icon} {meta.label} ({counts[k]})
            </div>
          );
        })}
        <div className={`cvw ${kindFilter === 'link' ? 'on' : ''}`} onClick={() => setKindFilter('link')}
          style={kindFilter === 'link' ? { color: '#AED8FF', background: '#AED8FF22' } : { color: '#AED8FF' }}>
          🔗 Links ({counts.link})
        </div>
      </div>

      {filtered.length === 0 ? (
        <ComingSoon
          icon="🗂"
          title={entries.length === 0 ? 'No assets yet' : 'Nothing matches this filter'}
          body={entries.length === 0
            ? 'Upload finished files here, or attach Google Drive links on a Production card — both land here, grouped by channel and format.'
            : 'Try a different brand or type filter to see more.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {channelKeys.map((ch) => {
            const cc = CHANNEL_COLOR[ch] || '#9494AA';
            const present = byChannel[ch];
            const chTotal = Object.values(present).reduce((s, arr) => s + arr.length, 0);
            // Tab order: canonical taxonomy first, then any extra formats present (e.g. General).
            const taxonomy = FORMATS_BY_CHANNEL[ch] || [];
            const extras = Object.keys(present).filter((f) => !taxonomy.includes(f)).sort((a, b) => a.localeCompare(b));
            const formatTabs = [...taxonomy, ...extras];
            // Active tab: remembered, else first format that actually has assets, else first tab.
            const firstWithItems = formatTabs.find((f) => (present[f] || []).length > 0);
            const active = fmtTab[ch] || firstWithItems || formatTabs[0];
            const activeItems = present[active] || [];
            return (
              <div key={ch}>
                {/* Channel header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `2px solid ${cc}33` }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: cc }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: cc }}>{ch}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>· {chTotal}</span>
                </div>

                {/* Format tabs */}
                <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 14 }}>
                  {formatTabs.map((fmt) => {
                    const n = (present[fmt] || []).length;
                    const on = fmt === active;
                    return (
                      <div key={fmt} className={`cvw ${on ? 'on' : ''}`}
                        onClick={() => setFmtTab((m) => ({ ...m, [ch]: fmt }))}
                        style={on ? { color: cc, background: cc + '22' } : { color: n ? 'var(--text2)' : 'var(--text3)' }}>
                        {fmt} ({n})
                      </div>
                    );
                  })}
                </div>

                {/* Active format grid */}
                {activeItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 2px 4px', marginBottom: 18 }}>
                    No assets in “{active}” yet.
                  </div>
                ) : (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
                      {activeItems.map((e) => {
                        const meta = e.kind === 'link' ? { label: 'Link', icon: '🔗', color: '#AED8FF' } : (KIND_META[e.kind] || KIND_META.doc);
                        const c = colorFor(e.brand_id);
                        const bName = (brandById(e.brand_id) || {}).name || 'Unassigned';
                        return (
                          <div key={e.key} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg2)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ position: 'relative', height: 130, background: 'var(--bg3)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                              {e.kind === 'image' ? (
                                <img src={e.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : e.kind === 'video' ? (
                                <video src={e.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
                              ) : (
                                <div style={{ fontSize: 38 }}>{meta.icon}</div>
                              )}
                              <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#fff', background: meta.color, padding: '2px 7px', borderRadius: 20 }}>{e.kind}</span>
                              {isCommand && e.assetRow && (
                                confirmId === e.assetRow.id ? (
                                  <span style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                                    <button type="button" onClick={() => removeAsset(e.assetRow)} title="Confirm delete"
                                      style={{ width: 22, height: 22, borderRadius: '50%', background: '#ff6464', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>✓</button>
                                    <button type="button" onClick={() => setConfirmId(null)} title="Cancel"
                                      style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>×</button>
                                  </span>
                                ) : (
                                  <button type="button" onClick={() => setConfirmId(e.assetRow.id)} title="Delete asset"
                                    style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                                )
                              )}
                            </div>
                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span className="sb2" style={{ background: c + '22', color: c, alignSelf: 'flex-start', fontSize: 10 }}>{bName}</span>
                              {e.contentTitle && (
                                <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.contentTitle}>
                                  ↳ {e.contentTitle}
                                </div>
                              )}
                              <a href={e.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--text2)', textDecoration: 'none' }}>Open ↗</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// =====================================================================
// LINE UP — Notion-style master table for public.mc_items. Every cell is
// directly editable in place (no modal), autosaving on blur/change via
// saveItem() called straight as a function — Next.js server actions can
// be invoked directly from client code, not only through <form action>,
// and revalidatePath() on the server refreshes the props naturally.
// Assembly (the kanban board) reads the exact same rows by status.
// =====================================================================
const MC_ITEM_KINDS = ['Poster', 'Menu Board', 'Packaging', 'Table Tent', 'Flyer', 'Signage', 'Sticker', 'Other'];
const MC_STATUS_META = {
  queued: { label: 'Queued', color: '#9494AA' },
  in_assembly: { label: 'In Assembly', color: '#ffbb44' },
  review: { label: 'In Review', color: '#78b8e8' },
  approved: { label: 'Approved', color: '#64BC46' },
};
const mcItemStatus = (s) => MC_STATUS_META[s] || MC_STATUS_META.queued;

function LineUpView({ mcItems = [], mcThemes = [], brands = [], isCommand }) {
  const [rows, setRows] = useState(mcItems);
  const [brandFilter, setBrandFilter] = useState(brands.length === 1 ? brands[0].id : 'all');
  const [savingId, setSavingId] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const newTitleRef = useRef(null);

  useEffect(() => { setRows(mcItems); }, [mcItems]);

  const brandById = (id) => brands.find((b) => b.id === id) || null;
  const themeById = (id) => mcThemes.find((t) => t.id === id) || null;

  function patchLocal(id, patch) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function updateField(item, field, value) {
    patchLocal(item.id, { [field]: value });
    setSavingId(item.id);
    setErrMsg('');
    try {
      const fd = new FormData();
      fd.set('id', item.id);
      fd.set(field, value ?? '');
      const res = await saveItem(null, fd);
      if (res?.error) setErrMsg(res.error);
    } catch (e) {
      setErrMsg(e.message || 'Could not save.');
    } finally {
      setSavingId((s) => (s === item.id ? null : s));
    }
  }

  async function addRow() {
    const brand_id = brandFilter !== 'all' ? brandFilter : (brands[0]?.id || '');
    if (!brand_id) { setErrMsg('Add a brand first.'); return; }
    const fd = new FormData();
    fd.set('brand_id', brand_id);
    fd.set('title', 'Untitled');
    const res = await saveItem(null, fd);
    if (res?.error) { setErrMsg(res.error); return; }
    if (res?.item) {
      setRows((rs) => [res.item, ...rs]);
      requestAnimationFrame(() => newTitleRef.current?.focus());
    }
  }

  async function removeRow(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setConfirmDel(null);
    const fd = new FormData();
    fd.set('id', id);
    const res = await deleteItem(null, fd);
    if (res?.error) setErrMsg(res.error);
  }

  const filtered = brandFilter === 'all' ? rows : rows.filter((r) => r.brand_id === brandFilter);
  const sorted = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const cellInp = { width: '100%', background: 'transparent', border: '1px solid transparent', borderRadius: 6, padding: '6px 7px', color: 'var(--text)', fontSize: 12.5, fontFamily: "'Inter',sans-serif" };
  const cellFocus = (e) => { e.target.style.background = 'var(--bg3)'; e.target.style.borderColor = 'var(--border)'; };
  const cellBlur = (e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; };

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Line Up</div>
          <div className="ps">Everything that needs producing for Marketing Collaterals — click any cell to edit</div>
        </div>
        {isCommand && <button type="button" className="btn bl" onClick={addRow}>＋ Add row</button>}
      </div>

      {brands.length > 1 && (
        <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 14 }}>
          <div className={`cvw ${brandFilter === 'all' ? 'on' : ''}`} onClick={() => setBrandFilter('all')}>All brands</div>
          {brands.map((b) => (
            <div key={b.id} className={`cvw ${brandFilter === b.id ? 'on' : ''}`} onClick={() => setBrandFilter(b.id)} style={brandFilter === b.id ? { color: b.color, background: b.color + '22' } : { color: b.color }}>{b.name}</div>
          ))}
        </div>
      )}

      {errMsg && <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464', marginBottom: 12 }}>{errMsg}</div>}

      {sorted.length === 0 ? (
        <ComingSoon
          icon="◇"
          title="Nothing in the Line Up yet"
          body={isCommand ? 'Add a row for every piece of collateral you need to produce — a poster, packaging, signage — then move it through Assembly as it gets made.' : 'No items in the Line Up for your brand yet.'}
        />
      ) : (
        <div className="sc" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                {['Title', 'Brand', 'Theme', 'Pillar', 'Kind', 'Due', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => {
                const theme = themeById(item.theme_id);
                const pillarOptions = Array.isArray(theme?.pillars) ? theme.pillars : [];
                const st = mcItemStatus(item.status);
                const isConfirming = confirmDel === item.id;
                const busy = savingId === item.id;
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: busy ? 0.7 : 1 }}>
                    <td style={{ minWidth: 180 }}>
                      <input
                        ref={idx === 0 ? newTitleRef : null}
                        style={cellInp}
                        defaultValue={item.title || ''}
                        disabled={!isCommand}
                        onFocus={cellFocus}
                        onBlur={(e) => { cellBlur(e); if (e.target.value !== item.title) updateField(item, 'title', e.target.value); }}
                        placeholder="Untitled"
                      />
                    </td>
                    <td style={{ minWidth: 130 }}>
                      {isCommand ? (
                        <select style={cellInp} value={item.brand_id || ''} onFocus={cellFocus} onBlur={cellBlur} onChange={(e) => updateField(item, 'brand_id', e.target.value)}>
                          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      ) : (
                        <span style={{ padding: '6px 7px', display: 'block' }}>{brandById(item.brand_id)?.name || '—'}</span>
                      )}
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <select style={cellInp} value={item.theme_id || ''} disabled={!isCommand} onFocus={cellFocus} onBlur={cellBlur} onChange={(e) => updateField(item, 'theme_id', e.target.value)}>
                        <option value="">— none —</option>
                        {mcThemes.filter((t) => !item.brand_id || t.brand_id === item.brand_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 130 }}>
                      {pillarOptions.length > 0 ? (
                        <select style={cellInp} value={item.pillar || ''} disabled={!isCommand} onFocus={cellFocus} onBlur={cellBlur} onChange={(e) => updateField(item, 'pillar', e.target.value)}>
                          <option value="">— none —</option>
                          {pillarOptions.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                        </select>
                      ) : (
                        <input style={cellInp} defaultValue={item.pillar || ''} disabled={!isCommand} onFocus={cellFocus} onBlur={(e) => { cellBlur(e); if (e.target.value !== item.pillar) updateField(item, 'pillar', e.target.value); }} placeholder="—" />
                      )}
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <select style={cellInp} value={item.kind || ''} disabled={!isCommand} onFocus={cellFocus} onBlur={cellBlur} onChange={(e) => updateField(item, 'kind', e.target.value)}>
                        <option value="">— none —</option>
                        {MC_ITEM_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <input type="date" style={cellInp} defaultValue={item.due_date || ''} disabled={!isCommand} onFocus={cellFocus} onBlur={(e) => { cellBlur(e); if (e.target.value !== item.due_date) updateField(item, 'due_date', e.target.value); }} />
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <select
                        style={{ ...cellInp, color: st.color, fontWeight: 700, background: st.color + '18' }}
                        value={item.status || 'queued'}
                        disabled={!isCommand}
                        onChange={(e) => updateField(item, 'status', e.target.value)}
                      >
                        {Object.entries(MC_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      {isCommand && (
                        isConfirming ? (
                          <span style={{ display: 'flex', gap: 5 }}>
                            <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px', color: '#ff6464' }} onClick={() => removeRow(item.id)}>Confirm</button>
                            <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => setConfirmDel(null)}>✕</button>
                          </span>
                        ) : (
                          <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px', color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }} onClick={() => setConfirmDel(item.id)}>🗑</button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// =====================================================================
// ASSEMBLY — kanban board over the same public.mc_items rows as Line Up.
// Mirrors ProductionView's drag/drop + advance-button pattern exactly,
// simplified: no "virtual idea card" step since Line Up rows ARE the
// queue (there's no separate promotion step for collaterals).
// =====================================================================
function AssemblyView({ mcItems = [], mcThemes = [], brands = [], isCommand }) {
  const [viewing, setViewing] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [errMsg, setErrMsg] = useState('');
  const [items, setItems] = useState(mcItems);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [attBusy, setAttBusy] = useState(false);

  useEffect(() => { setItems(mcItems); }, [mcItems]);

  const brandById = (id) => brands.find((b) => b.id === id) || null;
  const themeById = (id) => mcThemes.find((t) => t.id === id) || null;

  const COLS = [
    { id: 'queued', label: 'Queued', color: '#9494AA' },
    { id: 'in_assembly', label: 'In Assembly', color: '#ffbb44' },
    { id: 'review', label: 'In Review', color: '#78b8e8' },
    { id: 'approved', label: 'Approved', color: '#64BC46' },
  ];
  const nextOf = { queued: 'in_assembly', in_assembly: 'review', review: 'approved' };
  const prevOf = { in_assembly: 'queued', review: 'in_assembly', approved: 'review' };
  const colById = (id) => COLS.find((c) => c.id === id);

  async function moveTo(id, status) {
    setItems((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    setViewing((v) => (v && v.id === id ? { ...v, status } : v));
    setBusyId(id);
    const fd = new FormData();
    fd.set('id', id);
    fd.set('status', status);
    const res = await setItemStatus(null, fd);
    if (res?.error) setErrMsg(res.error);
    setBusyId(null);
  }

  async function saveAttachments(item, list) {
    setAttBusy(true);
    setItems((rs) => rs.map((r) => (r.id === item.id ? { ...r, attachments: list } : r)));
    setViewing((v) => (v && v.id === item.id ? { ...v, attachments: list } : v));
    const fd = new FormData();
    fd.set('id', item.id);
    fd.set('attachments', JSON.stringify(list));
    const res = await setItemAttachments(null, fd);
    if (res?.error) setErrMsg(res.error);
    setAttBusy(false);
  }
  function addLink(item) {
    const url = linkUrl.trim();
    if (!url) return;
    saveAttachments(item, [...(item.attachments || []), { type: 'link', url, name: linkName.trim() }]);
    setLinkUrl(''); setLinkName('');
  }
  function removeLink(item, idx) {
    saveAttachments(item, (item.attachments || []).filter((_, i) => i !== idx));
  }

  function onDrop(colId) {
    if (dragId) {
      const item = items.find((c) => c.id === dragId);
      if (item && item.status !== colId) moveTo(dragId, colId);
    }
    setDragId(null);
    setOverCol(null);
  }

  if (viewing) {
    const c = viewing;
    const b = brandById(c.brand_id);
    const bc = b?.color || '#9494AA';
    const st = colById(c.status) || COLS[0];
    const theme = themeById(c.theme_id);
    return (
      <>
        <div className="ph">
          <div><div className="pt">{c.title || 'Untitled'}</div><div className="ps">Assembly detail</div></div>
          <button type="button" className="btn bg" onClick={() => setViewing(null)}>← Back to board</button>
        </div>
        <div className="sc" style={{ padding: 22, maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="ap-chip" style={{ background: bc + '22', color: bc }}>{b?.name || 'Unassigned'}</span>
            <span className="ap-chip" style={{ background: st.color + '22', color: st.color }}>● {st.label}</span>
            {c.kind && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>{c.kind}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><div style={cLbl}>Theme</div><div style={{ fontSize: 13, color: 'var(--text2)' }}>{theme ? theme.name : '—'}</div></div>
            <div><div style={cLbl}>Due</div><div style={{ fontSize: 13, color: 'var(--text2)' }}>{c.due_date || '—'}</div></div>
          </div>
          <div>
            <div style={cLbl}>Notes</div>
            <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{c.notes || <span style={{ color: 'var(--text3)' }}>No notes yet.</span>}</div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={cLbl}>Links · finished files land in Assets</div>
            {(c.attachments || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>No links yet. Paste a share link below — it will also show up in Assets.</div>
            )}
            {(c.attachments || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {(c.attachments || []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
                    <span style={{ fontSize: 14 }}>🔗</span>
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12.5, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.url}>{a.name || a.url}</a>
                    {isCommand && <button type="button" className="btn bg" disabled={attBusy} onClick={() => removeLink(c, i)} style={{ fontSize: 11, padding: '3px 8px', color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }}>Remove</button>}
                  </div>
                ))}
              </div>
            )}
            {isCommand && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 260px' }}>
                  <input style={cInp} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://drive.google.com/…" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(c); } }} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <input style={cInp} value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Label (optional)" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(c); } }} />
                </div>
                <button type="button" className={`btn bl ${attBusy ? 'loading' : ''}`} disabled={attBusy || !linkUrl.trim()} onClick={() => addLink(c)}>＋ Add link</button>
              </div>
            )}
          </div>

          {errMsg && <div style={{ fontSize: 12, color: '#ff6464' }}>{errMsg}</div>}
          {isCommand && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              {prevOf[c.status] && (
                <button type="button" className="btn bg" disabled={busyId === c.id} onClick={() => moveTo(c.id, prevOf[c.status])}>← {colById(prevOf[c.status])?.label}</button>
              )}
              {nextOf[c.status] && (
                <button type="button" className="btn bg" style={{ color: '#64BC46' }} disabled={busyId === c.id} onClick={() => moveTo(c.id, nextOf[c.status])}>{colById(nextOf[c.status])?.label} →</button>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ph">
        <div><div className="pt">Assembly</div><div className="ps">{items.length} items · move Line Up work through to approval</div></div>
      </div>

      {errMsg && <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464' }}>{errMsg}</div>}

      {isCommand && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Drag a card between columns to change its status, or click it to view details.</div>
      )}

      <div className="ap-board" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {COLS.map((col) => {
          const colItems = items.filter((c) => c.status === col.id);
          const isOver = overCol === col.id && dragId;
          return (
            <div
              className="ap-col"
              key={col.id}
              onDragOver={isCommand ? (e) => { e.preventDefault(); if (overCol !== col.id) setOverCol(col.id); } : undefined}
              onDragLeave={isCommand ? (e) => { if (e.currentTarget === e.target) setOverCol((o) => (o === col.id ? null : o)); } : undefined}
              onDrop={isCommand ? (e) => { e.preventDefault(); onDrop(col.id); } : undefined}
              style={isOver ? { outline: `2px dashed ${col.color}`, outlineOffset: -2, background: col.color + '0d', borderRadius: 12 } : {}}
            >
              <div className="ap-col-hd">
                <span className="ap-col-dot" style={{ background: col.color }} />
                <span className="ap-col-t" style={{ color: col.color }}>{col.label}</span>
                <span className="ap-col-n">{colItems.length}</span>
              </div>
              <div className="ap-col-bd">
                {colItems.length === 0 && <div className="ap-empty">{isOver ? 'Drop here' : '—'}</div>}
                {colItems.map((i) => {
                  const b = brandById(i.brand_id);
                  const bc = b?.color || '#9494AA';
                  const isDragging = dragId === i.id;
                  return (
                    <div
                      className="ap-card"
                      key={i.id}
                      draggable={isCommand}
                      onDragStart={isCommand ? (e) => { setDragId(i.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                      onDragEnd={isCommand ? () => { setDragId(null); setOverCol(null); } : undefined}
                      onClick={() => setViewing(i)}
                      style={{ cursor: 'pointer', opacity: isDragging ? 0.4 : 1, transition: 'opacity .12s, box-shadow .12s' }}
                      title="Click to open · drag to move"
                    >
                      <div className="ap-card-t">{i.title}</div>
                      {i.kind && <div style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0' }}>{i.kind}</div>}
                      <div className="ap-card-m"><span className="ap-chip" style={{ background: bc + '22', color: bc }}>{b?.name || 'Unassigned'}</span>{i.due_date && <span className="ap-chip" style={{ background: 'var(--bg2)', color: 'var(--text3)', marginLeft: 6 }}>📅 {i.due_date}</span>}</div>
                      {isCommand && (
                        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {prevOf[i.status] && (
                            <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => moveTo(i.id, prevOf[i.status])}>←</button>
                          )}
                          {nextOf[i.status] && (
                            <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px', color: '#64BC46' }} onClick={() => moveTo(i.id, nextOf[i.status])}>Advance →</button>
                          )}
                        </div>
                      )}
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
// MC ASSET LIBRARY — mirrors AssetLibrary exactly, but merges uploaded
// mc_assets files with link attachments from mc_items, grouped by
// Theme → Kind instead of Channel → Format (collaterals have neither).
// =====================================================================
function McAssetLibrary({ mcAssets = [], mcItems = [], mcThemes = [], brands = [], brandColor, isCommand }) {
  const [brandFilter, setBrandFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [themeTab, setThemeTab] = useState({});

  const [saveState, saveAction] = useActionState(saveMcAsset, {});
  const [delState, deleteAction] = useActionState(deleteMcAsset, {});

  const brandById = (id) => brands.find((b) => b.id === id) || null;
  const itemById = (id) => mcItems.find((i) => i.id === id) || null;
  const colorFor = (id) => {
    const b = brandById(id);
    return (b && b.color) || (b && brandColor ? brandColor(b.name) : '#9494AA');
  };

  function publicUrl(storage_path) {
    if (!storage_path) return '';
    if (/^https?:\/\//.test(storage_path)) return storage_path;
    const supabase = createBrowserClient();
    const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(storage_path);
    return data.publicUrl;
  }

  function themeKind(item) {
    const theme = item ? mcThemes.find((t) => t.id === item.theme_id) : null;
    return { theme: theme?.name || 'No theme', kind: item?.kind || 'General' };
  }

  const entries = [];
  for (const a of mcAssets) {
    const item = itemById(a.item_id);
    const { theme, kind } = themeKind(item);
    entries.push({
      key: `asset-${a.id}`,
      fileKind: a.kind || 'doc',
      brand_id: a.brand_id,
      url: publicUrl(a.storage_path),
      name: (a.storage_path || '').split('/').pop() || 'file',
      theme, kind,
      itemTitle: item?.title || null,
      assetRow: a,
    });
  }
  for (const item of mcItems) {
    const list = Array.isArray(item.attachments) ? item.attachments : [];
    const { theme, kind } = themeKind(item);
    list.forEach((att, i) => {
      if (!att?.url) return;
      entries.push({
        key: `link-${item.id}-${i}`,
        fileKind: 'link',
        brand_id: item.brand_id,
        url: att.url,
        name: att.name || att.url,
        theme, kind,
        itemTitle: item.title || null,
        assetRow: null,
      });
    });
  }

  async function handleUpload(fileList) {
    setUploadErr('');
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let targetBrand = brandFilter !== 'all' ? brandFilter : (brands.length === 1 ? brands[0].id : '');
    if (!targetBrand) { setUploadErr('Pick a brand tab first, then upload — so each file is tagged to the right brand.'); return; }
    setUploading(true);
    try {
      const supabase = createBrowserClient();
      for (const file of files) {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const key = `mc-${targetBrand}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await supabase.storage.from(ASSET_BUCKET).upload(key, file, { upsert: true });
        if (error) throw error;
        const fd = new FormData();
        fd.set('brand_id', targetBrand);
        fd.set('storage_path', key);
        fd.set('kind', kindFromFile(file));
        saveAction(fd);
      }
    } catch (err) {
      setUploadErr(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function removeAsset(asset) {
    const fd = new FormData();
    fd.set('id', asset.id);
    fd.set('storage_path', asset.storage_path || '');
    deleteAction(fd);
    setConfirmId(null);
  }

  const counts = {
    all: entries.length,
    image: entries.filter((e) => e.fileKind === 'image').length,
    video: entries.filter((e) => e.fileKind === 'video').length,
    doc: entries.filter((e) => e.fileKind === 'doc').length,
    link: entries.filter((e) => e.fileKind === 'link').length,
  };

  const filtered = entries.filter((e) => {
    if (brandFilter !== 'all' && e.brand_id !== brandFilter) return false;
    if (kindFilter !== 'all' && e.fileKind !== kindFilter) return false;
    return true;
  });

  const byTheme = {};
  for (const e of filtered) { (byTheme[e.theme] ||= {}); (byTheme[e.theme][e.kind] ||= []).push(e); }
  const themeKeys = Object.keys(byTheme).sort((a, b) => (a === 'No theme' ? 1 : b === 'No theme' ? -1 : a.localeCompare(b)));

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Assets</div>
          <div className="ps">Every finished file and link produced under Marketing Collaterals — grouped by theme and kind.</div>
        </div>
        {isCommand && (
          <label className="btn bl" style={{ cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
            {uploading ? 'Uploading…' : '＋ Upload assets'}
            <input type="file" multiple accept="image/*,video/*,application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.zip" onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} disabled={uploading} />
          </label>
        )}
      </div>

      {uploadErr && <div style={{ fontSize: 12, color: '#ff6464', marginBottom: 12 }}>{uploadErr}</div>}
      {saveState?.error && <div style={{ fontSize: 12, color: '#ff6464', marginBottom: 12 }}>{saveState.error}</div>}
      {delState?.error && <div style={{ fontSize: 12, color: '#ff6464', marginBottom: 12 }}>{delState.error}</div>}

      {brands.length > 1 && (
        <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 10 }}>
          <div className={`cvw ${brandFilter === 'all' ? 'on' : ''}`} onClick={() => setBrandFilter('all')}>All brands</div>
          {brands.map((b) => {
            const on = brandFilter === b.id;
            const c = b.color || (brandColor ? brandColor(b.name) : '#9494AA');
            return <div key={b.id} className={`cvw ${on ? 'on' : ''}`} onClick={() => setBrandFilter(b.id)} style={on ? { color: c, background: c + '22' } : { color: c }}>{b.name}</div>;
          })}
        </div>
      )}

      <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 16 }}>
        <div className={`cvw ${kindFilter === 'all' ? 'on' : ''}`} onClick={() => setKindFilter('all')}>All ({counts.all})</div>
        {Object.entries(KIND_META).map(([k, meta]) => {
          const on = kindFilter === k;
          return <div key={k} className={`cvw ${on ? 'on' : ''}`} onClick={() => setKindFilter(k)} style={on ? { color: meta.color, background: meta.color + '22' } : { color: meta.color }}>{meta.icon} {meta.label} ({counts[k]})</div>;
        })}
        <div className={`cvw ${kindFilter === 'link' ? 'on' : ''}`} onClick={() => setKindFilter('link')} style={kindFilter === 'link' ? { color: '#AED8FF', background: '#AED8FF22' } : { color: '#AED8FF' }}>🔗 Links ({counts.link})</div>
      </div>

      {filtered.length === 0 ? (
        <ComingSoon
          icon="🗂"
          title={entries.length === 0 ? 'No assets yet' : 'Nothing matches this filter'}
          body={entries.length === 0 ? 'Upload finished files here, or attach links on an Assembly card — both land here, grouped by theme and kind.' : 'Try a different brand or type filter to see more.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {themeKeys.map((th) => {
            const present = byTheme[th];
            const thTotal = Object.values(present).reduce((s, arr) => s + arr.length, 0);
            const kindTabs = Object.keys(present).sort((a, b) => a.localeCompare(b));
            const active = themeTab[th] || kindTabs[0];
            const activeItems = present[active] || [];
            return (
              <div key={th}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #FFAEF133' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFAEF1' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#FFAEF1' }}>{th}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>· {thTotal}</span>
                </div>
                <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 14 }}>
                  {kindTabs.map((k) => {
                    const n = (present[k] || []).length;
                    const on = k === active;
                    return <div key={k} className={`cvw ${on ? 'on' : ''}`} onClick={() => setThemeTab((m) => ({ ...m, [th]: k }))} style={on ? { color: '#FFAEF1', background: '#FFAEF122' } : { color: 'var(--text2)' }}>{k} ({n})</div>;
                  })}
                </div>
                {activeItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 2px 4px', marginBottom: 18 }}>No assets in "{active}" yet.</div>
                ) : (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
                      {activeItems.map((e) => {
                        const meta = e.fileKind === 'link' ? { label: 'Link', icon: '🔗', color: '#AED8FF' } : (KIND_META[e.fileKind] || KIND_META.doc);
                        const c = colorFor(e.brand_id);
                        const bName = (brandById(e.brand_id) || {}).name || 'Unassigned';
                        return (
                          <div key={e.key} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg2)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ position: 'relative', height: 130, background: 'var(--bg3)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                              {e.fileKind === 'image' ? (
                                <img src={e.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : e.fileKind === 'video' ? (
                                <video src={e.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
                              ) : (
                                <div style={{ fontSize: 38 }}>{meta.icon}</div>
                              )}
                              <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#fff', background: meta.color, padding: '2px 7px', borderRadius: 20 }}>{e.fileKind}</span>
                              {isCommand && e.assetRow && (
                                confirmId === e.assetRow.id ? (
                                  <span style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                                    <button type="button" onClick={() => removeAsset(e.assetRow)} title="Confirm delete" style={{ width: 22, height: 22, borderRadius: '50%', background: '#ff6464', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>✓</button>
                                    <button type="button" onClick={() => setConfirmId(null)} title="Cancel" style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>×</button>
                                  </span>
                                ) : (
                                  <button type="button" onClick={() => setConfirmId(e.assetRow.id)} title="Delete asset" style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                                )
                              )}
                            </div>
                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span className="sb2" style={{ background: c + '22', color: c, alignSelf: 'flex-start', fontSize: 10 }}>{bName}</span>
                              {e.itemTitle && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.itemTitle}>↳ {e.itemTitle}</div>}
                              <a href={e.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--text2)', textDecoration: 'none' }}>Open ↗</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}


// One table per campaign — bulk row entry for ideas, built for visibility
// across a campaign's whole content plan at a glance. Every row IS a row in
// the `ideas` table; flipping a row's Ready switch is what makes it pop as
// a card in the Ideas module (ideas.ready = true) — it stays in this table
// either way, since the bucket is meant to stay the full plan of record.
function ContentBucketView({ ideas, brands, campaigns, brandById, isCommand }) {
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null); // row opened for read-only detail
  const [editing, setEditing] = useState(null);
  const [state, formAction, pending] = useActionState(saveIdea, {});
  const [, readyAction, togglingReady] = useActionState(setIdeaReady, {});
  const [delState, deleteAction, deletingIdea] = useActionState(deleteIdea, {});
  const [dupState, duplicateAction, duplicating] = useActionState(duplicateIdea, {});
  const [brandId, setBrandId] = useState('');
  const [campId, setCampId] = useState('');
  const [pillar, setPillar] = useState('');
  const [channel, setChannel] = useState('');
  const [format, setFormat] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [ready, setReady] = useState(false);
  const [slides, setSlides] = useState(['', '', '', '', '']);

  // Per-column filters for the table below — independent of the "add/edit
  // row" form fields above, which reuse some of the same names.
  const [fTitle, setFTitle] = useState('');
  const [fBrand, setFBrand] = useState('all');
  const [fPillar, setFPillar] = useState('all');
  const [fChannel, setFChannel] = useState('all');
  const [fFormat, setFFormat] = useState('all');
  const [fReady, setFReady] = useState('all'); // all | ready | draft
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const [sortKey, setSortKey] = useState(null); // title | brand | pillar | channel | format | publish_date | ready
  const [sortDir, setSortDir] = useState('asc');
  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  useEffect(() => { if (state?.ok) { setShowForm(false); setEditing(null); } }, [state?.ok]);

  const selectedCamp = campaigns.find((c) => c.id === campId);
  const pillarOptions = Array.isArray(selectedCamp?.pillars) ? selectedCamp.pillars : [];
  const formatOptions = FORMATS_BY_CHANNEL[channel] || [];
  const isCarousel = /carousel/i.test(format);

  function openNewRow(forCampaignId) {
    setEditing(null);
    setBrandId(brands[0]?.id || '');
    setCampId(forCampaignId || '');
    setPillar(''); setChannel(''); setFormat(''); setPublishDate(''); setReady(false);
    setSlides(['', '', '', '', '']);
    setShowForm(true);
  }
  function openEditRow(i) {
    setEditing(i);
    setBrandId(i.brand_id || '');
    setCampId(i.campaign_id || '');
    setPillar(i.pillar || '');
    setChannel(i.channel || '');
    setFormat(i.format || '');
    setPublishDate(i.publish_date || '');
    setReady(!!i.ready);
    const existing = Array.isArray(i.carousel_slides) ? i.carousel_slides : [];
    setSlides(Array.from({ length: 5 }, (_, idx) => existing[idx] || ''));
    setShowForm(true);
  }
  function toggleReady(i) {
    const fd = new FormData();
    fd.set('id', i.id);
    fd.set('ready', (!i.ready).toString());
    readyAction(fd);
  }

  // Distinct values actually present in the data, so dropdowns only ever
  // show options that could return results (no picking "Reels" and getting
  // an empty table because nothing uses that format yet).
  const pillarValues = [...new Set(ideas.map((i) => i.pillar).filter(Boolean))].sort();
  const channelValues = [...new Set(ideas.map((i) => i.channel).filter(Boolean))].sort();
  const formatValues = [...new Set(ideas.map((i) => i.format).filter(Boolean))].sort();
  const hasActiveFilter = fTitle || fBrand !== 'all' || fPillar !== 'all' || fChannel !== 'all' || fFormat !== 'all' || fReady !== 'all' || fFrom || fTo;

  const filteredIdeas = ideas.filter((i) => {
    if (fTitle && !(i.title || '').toLowerCase().includes(fTitle.toLowerCase())) return false;
    if (fBrand !== 'all' && i.brand_id !== fBrand) return false;
    if (fPillar !== 'all' && i.pillar !== fPillar) return false;
    if (fChannel !== 'all' && i.channel !== fChannel) return false;
    if (fFormat !== 'all' && i.format !== fFormat) return false;
    if (fReady === 'ready' && !i.ready) return false;
    if (fReady === 'draft' && i.ready) return false;
    if (fFrom && (!i.publish_date || i.publish_date < fFrom)) return false;
    if (fTo && (!i.publish_date || i.publish_date > fTo)) return false;
    return true;
  });

  // Sort — applied across the whole filtered set before it's split back
  // into per-campaign groups, so ordering stays consistent everywhere.
  let sortedIdeas = filteredIdeas;
  if (sortKey) {
    sortedIdeas = [...filteredIdeas].sort((a, b) => {
      let av, bv;
      if (sortKey === 'brand') { av = brandById(a.brand_id)?.name || ''; bv = brandById(b.brand_id)?.name || ''; }
      else if (sortKey === 'ready') { av = a.ready ? 1 : 0; bv = b.ready ? 1 : 0; }
      else { av = a[sortKey] || ''; bv = b[sortKey] || ''; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Group ideas by campaign; ideas without a (valid) campaign fall into
  // a trailing "No campaign" table so nothing gets lost from view.
  const groups = campaigns.map((c) => ({ campaign: c, rows: sortedIdeas.filter((i) => i.campaign_id === c.id) }));
  const campIds = new Set(campaigns.map((c) => c.id));
  const unassigned = sortedIdeas.filter((i) => !i.campaign_id || !campIds.has(i.campaign_id));
  if (unassigned.length > 0 || campaigns.length === 0) {
    groups.push({ campaign: null, rows: unassigned });
  }

  // Read-only detail — table rows are truncated to one line, so this is
  // the only place to see the full hook/caption/hashtags/mandatories/notes
  // without opening the edit form. Available to everyone (view is safe
  // for freelance too), even though edit/duplicate/delete stay command-only.
  // Rendered as a Modal popup below (Notion-style row peek) instead of
  // replacing the whole page, so the table/filters/scroll stay intact.
  let viewingPanel = null;
  if (viewing) {
    const i = viewing;
    const b = brandById(i.brand_id);
    const bc = b?.color || '#9494AA';
    const camp = campaigns.find((c) => c.id === i.campaign_id);
    const cc = CHANNEL_COLOR[i.channel] || '#9494AA';
    viewingPanel = (
      <Modal title={i.title || 'Untitled'} subtitle="Content Bucket row detail" onClose={() => setViewing(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="ap-chip" style={{ background: bc + '22', color: bc }}>{b?.name || 'Unassigned'}</span>
            {camp && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>◆ {camp.name}</span>}
            {i.pillar && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>{i.pillar}</span>}
            {i.channel && <span className="ap-chip" style={{ background: cc + '22', color: cc }}>{i.channel}</span>}
            {i.format && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>{i.format}</span>}
            <Pill text={i.ready ? 'Ready' : 'Draft'} color={i.ready ? '#64BC46' : '#9494AA'} />
          </div>

          <DateRow publish={i.publish_date} production={i.production_due} edit={i.edit_due} />

          {i.hook && <div><div style={cLbl}>Hook</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.hook}</div></div>}
          {i.caption && <div><div style={cLbl}>Caption</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.caption}</div></div>}
          {i.hashtags && <div><div style={cLbl}>Hashtags</div><div style={{ fontSize: 13, color: cc, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.hashtags}</div></div>}
          {i.mandatories && <div><div style={cLbl}>Mandatories</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.mandatories}</div></div>}
          {i.notes && <div><div style={cLbl}>Notes</div><div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.notes}</div></div>}

          {/carousel/i.test(i.format || '') && Array.isArray(i.carousel_slides) && i.carousel_slides.some(Boolean) && (
            <div>
              <div style={cLbl}>Carousel Slides</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {i.carousel_slides.map((s, idx) => s ? (
                  <div key={idx} style={{ fontSize: 12.5, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Slide {idx + 1}: </span>{s}
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {!i.hook && !i.caption && !i.hashtags && !i.mandatories && !i.notes && (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>No additional details filled in yet.</div>
          )}

          {isCommand && (
            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button type="button" className="btn bl" onClick={() => { setViewing(null); openEditRow(i); }}>✎ Edit</button>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <>
      {viewingPanel}

      <div className="ph">
        <div>
          <div className="pt">Content Bucket</div>
          <div className="ps">{ideas.length} rows across {campaigns.length || 0} campaign{campaigns.length === 1 ? '' : 's'} · fill rows fast, then flip a row to Ready to pop it into Ideas</div>
        </div>
        {isCommand && !showForm && <button type="button" className="btn bl" onClick={() => openNewRow(campaigns[0]?.id || '')}>＋ New row</button>}
      </div>

      {(state?.error || delState?.error || dupState?.error) && (
        <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464' }}>{state?.error || delState?.error || dupState?.error}</div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit row' : 'New row'} subtitle={editing ? editing.title : 'Add a row to the Content Bucket'} onClose={() => { setShowForm(false); setEditing(null); }} maxWidth={720}>
        <form action={formAction}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="brand_id" value={brandId} />
          <input type="hidden" name="campaign_id" value={campId} />
          <input type="hidden" name="pillar" value={pillar} />
          <input type="hidden" name="channel" value={channel} />
          <input type="hidden" name="format" value={format} />
          <input type="hidden" name="publish_date" value={publishDate} />
          <input type="hidden" name="status" value="new" />
          <input type="hidden" name="ready" value={ready ? 'true' : 'false'} />
          <input type="hidden" name="carousel_slides" value={JSON.stringify(slides)} />

          <CField label="Title"><input style={cInp} name="title" defaultValue={editing?.title || ''} placeholder="e.g. Behind-the-bar matcha ritual reel" /></CField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <CField label="Brand">
              <select style={cInp} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </CField>
            <CField label="Campaign">
              <select style={cInp} value={campId} onChange={(e) => { setCampId(e.target.value); setPillar(''); }}>
                <option value="">— none —</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </CField>
          </div>

          <CField label="Content Pillar">
            {campId === '' ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0' }}>Pick a campaign first to choose one of its pillars.</div>
            ) : pillarOptions.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '4px 0' }}>This campaign has no pillars yet. Add them in the campaign editor.</div>
            ) : (
              <select style={cInp} value={pillar} onChange={(e) => setPillar(e.target.value)}>
                <option value="">— pick a pillar —</option>
                {pillarOptions.map((p, idx) => <option key={idx} value={p.name}>{p.name}</option>)}
              </select>
            )}
          </CField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <CField label="Channel">
              <select style={cInp} value={channel} onChange={(e) => { setChannel(e.target.value); setFormat(''); }}>
                <option value="">— pick a channel —</option>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </CField>
            <CField label="Format">
              <select style={cInp} value={format} onChange={(e) => setFormat(e.target.value)} disabled={!channel}>
                <option value="">{channel ? '— pick a format —' : 'pick a channel first'}</option>
                {formatOptions.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </CField>
          </div>

          {isCarousel && (
            <CField label="Carousel Slides">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slides.map((s, idx) => (
                  <textarea
                    key={idx}
                    style={cTa(46)}
                    value={s}
                    onChange={(e) => setSlides((prev) => prev.map((p, pi) => (pi === idx ? e.target.value : p)))}
                    placeholder={`Slide ${idx + 1} — copy / on-slide text`}
                  />
                ))}
              </div>
            </CField>
          )}

          <CField label="Publish Date">
            <input style={cInp} type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
            <DueDatePreview publish={publishDate} />
          </CField>

          <CField label="Hook"><textarea style={cTa(60)} name="hook" defaultValue={editing?.hook || ''} placeholder="The scroll-stopper. First line / first 2 seconds." /></CField>
          <CField label="Caption"><textarea style={cTa(90)} name="caption" defaultValue={editing?.caption || ''} placeholder="The full caption copy." /></CField>
          <CField label="Hashtags"><textarea style={cTa(50)} name="hashtags" defaultValue={editing?.hashtags || ''} placeholder="#matcha #specialtytea #ohheythere" /></CField>
          <CField label="Mandatories"><textarea style={cTa(60)} name="mandatories" defaultValue={editing?.mandatories || ''} placeholder="Must-includes: logo, link in bio, disclaimer, tag partners, etc." /></CField>
          <CField label="Notes"><textarea style={cTa(60)} name="notes" defaultValue={editing?.notes || ''} placeholder="Any extra context, the angle, why it matters." /></CField>

          <CField label="Ready for Ideas?">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} />
              Pop this row into the Ideas module as a card
            </label>
          </CField>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className={`btn bl ${pending ? 'loading' : ''}`} type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save row' : 'Add row'}</button>
            <button className="btn bg" type="button" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
          </div>
        </form>
        </Modal>
      )}

      {ideas.length === 0 && !showForm ? (
        <ComingSoon icon="▦" title="No rows yet" body={isCommand ? 'Add your first row — pick a campaign, pillar, channel and format. Flip Ready when it is solid enough to work as an idea.' : 'No content bucket rows for your brand yet.'} actionLabel={isCommand ? '＋ New row' : undefined} onAction={isCommand ? () => openNewRow('') : undefined} />
      ) : (
        <>
          {/* Per-column filters — narrows every campaign table below at once. */}
          <div className="sc" style={{ padding: 12, marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
              <label style={cLbl}>Title</label>
              <input style={cInp} value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Search title…" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
              <label style={cLbl}>Brand</label>
              <select style={cInp} value={fBrand} onChange={(e) => setFBrand(e.target.value)}>
                <option value="all">All brands</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
              <label style={cLbl}>Pillar</label>
              <select style={cInp} value={fPillar} onChange={(e) => setFPillar(e.target.value)}>
                <option value="all">All pillars</option>
                {pillarValues.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
              <label style={cLbl}>Channel</label>
              <select style={cInp} value={fChannel} onChange={(e) => setFChannel(e.target.value)}>
                <option value="all">All channels</option>
                {channelValues.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
              <label style={cLbl}>Format</label>
              <select style={cInp} value={fFormat} onChange={(e) => setFFormat(e.target.value)}>
                <option value="all">All formats</option>
                {formatValues.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
              <label style={cLbl}>Publish from</label>
              <input style={cInp} type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
              <label style={cLbl}>Publish to</label>
              <input style={cInp} type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
              <label style={cLbl}>Ready</label>
              <select style={cInp} value={fReady} onChange={(e) => setFReady(e.target.value)}>
                <option value="all">All</option>
                <option value="ready">Ready</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            {hasActiveFilter && (
              <button type="button" className="btn bg" style={{ fontSize: 12, height: 34 }}
                onClick={() => { setFTitle(''); setFBrand('all'); setFPillar('all'); setFChannel('all'); setFFormat('all'); setFReady('all'); setFFrom(''); setFTo(''); }}>
                ✕ Clear filters
              </button>
            )}
          </div>

          {hasActiveFilter && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, marginTop: -8 }}>
              Showing {filteredIdeas.length} of {ideas.length} row{ideas.length === 1 ? '' : 's'}
            </div>
          )}

          {filteredIdeas.length === 0 ? (
            <ComingSoon icon="▦" title="No rows match these filters" body="Try clearing a filter or two." />
          ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map((g) => (
            <div key={g.campaign?.id || 'none'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>{g.campaign ? g.campaign.name : 'No campaign'}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>· {g.rows.length} row{g.rows.length === 1 ? '' : 's'}</span>
                {isCommand && <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 9px', marginLeft: 'auto' }} onClick={() => openNewRow(g.campaign?.id || '')}>＋ Row</button>}
              </div>
              {g.rows.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '10px 0' }}>No rows yet for this campaign.</div>
              ) : (
                <div className="sc" style={{ overflowX: 'auto', padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                        {[
                          { key: 'title', label: 'Title' },
                          { key: 'brand', label: 'Brand' },
                          { key: 'pillar', label: 'Pillar' },
                          { key: 'channel', label: 'Channel' },
                          { key: 'format', label: 'Format' },
                          { key: 'publish_date', label: 'Publish' },
                          { key: 'ready', label: 'Ready' },
                          { key: null, label: '' },
                        ].map((h) => (
                          <th key={h.label || 'actions'}
                            onClick={h.key ? () => toggleSort(h.key) : undefined}
                            style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: sortKey === h.key ? 'var(--text)' : 'var(--text3)', whiteSpace: 'nowrap', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                            {h.label}{h.key && <span style={{ marginLeft: 4, opacity: sortKey === h.key ? 1 : 0.25 }}>{sortKey === h.key && sortDir === 'desc' ? '▼' : '▲'}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((i) => {
                        const b = brandById(i.brand_id);
                        const bc = b?.color || '#9494AA';
                        const cc = CHANNEL_COLOR[i.channel] || '#9494AA';
                        return (
                          <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.title}>{i.title}</td>
                            <td style={{ padding: '8px 10px' }}><span style={{ fontSize: 10, fontWeight: 600, color: bc, background: bc + '1c', padding: '2px 7px', borderRadius: 5 }}>{b?.name || '—'}</span></td>
                            <td style={{ padding: '8px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{i.pillar || '—'}</td>
                            <td style={{ padding: '8px 10px' }}>{i.channel ? <span style={{ fontSize: 10, fontWeight: 600, color: cc, background: cc + '1c', padding: '2px 7px', borderRadius: 5 }}>{i.channel}</span> : '—'}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                              {i.format || '—'}
                              {/carousel/i.test(i.format || '') && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: Array.isArray(i.carousel_slides) && i.carousel_slides.filter(Boolean).length === 5 ? '#64BC46' : 'var(--text3)' }}>
                                  ({Array.isArray(i.carousel_slides) ? i.carousel_slides.filter(Boolean).length : 0}/5 slides)
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{i.publish_date || '—'}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {isCommand ? (
                                <button type="button" className="btn bg" disabled={togglingReady} onClick={() => toggleReady(i)}
                                  style={i.ready ? { fontSize: 10, padding: '3px 8px', color: '#64BC46', borderColor: 'rgba(100,188,70,.4)' } : { fontSize: 10, padding: '3px 8px' }}>
                                  {i.ready ? '✓ Ready' : 'Mark ready'}
                                </button>
                              ) : (
                                <Pill text={i.ready ? 'Ready' : 'Draft'} color={i.ready ? '#64BC46' : '#9494AA'} />
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 5 }}>
                                <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => setViewing(i)} title="View details">👁</button>
                                {isCommand && (
                                  <>
                                    <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => openEditRow(i)}>✎</button>
                                    <form action={duplicateAction}><input type="hidden" name="id" value={i.id} />
                                      <button className="btn bg" type="submit" disabled={duplicating} title="Duplicate row" style={{ fontSize: 11, padding: '3px 7px' }}>⧉</button></form>
                                    <form action={deleteAction}><input type="hidden" name="id" value={i.id} />
                                      <button className="btn bg" type="submit" disabled={deletingIdea} style={{ fontSize: 11, padding: '3px 7px', color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }}>🗑</button></form>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
          )}
        </>
      )}
    </>
  );
}

// ----------------------------------------------------------------- IDEAS
// Cards for ideas marked ready in the Content Bucket. Promoting sends an
// idea straight into Production (content_items linked via idea_id) — Briefs
// has been retired; editing detail happens back in the Content Bucket.
function IdeasView({ ideas, content = [], brands, campaigns, brandById, isCommand }) {
  const readyIdeas = ideas.filter((i) => i.ready);
  const [viewing, setViewing] = useState(null); // idea opened for full-detail read-only view
  const [brandFilter, setBrandFilter] = useState(brands.length === 1 ? brands[0].id : 'all');
  const [statusFilter, setStatusFilter] = useState('all'); // all | new | production
  const [viewMode, setViewMode] = useState('grid'); // grid | table
  const [, promoteAction, promoting] = useActionState(promoteIdeaToProduction, {});
  const [delState, deleteAction, deletingIdea] = useActionState(deleteIdea, {});

  const promotedIdeaIds = new Set(content.filter((c) => c.idea_id).map((c) => c.idea_id));

  // Full detail — the card view clamps caption to 3 lines and never shows
  // mandatories/notes at all, so this is the only place to read everything.
  // Rendered as a Modal popup (see below) instead of replacing the page.
  let viewingPanel = null;
  if (viewing) {
    const i = viewing;
    const b = brandById(i.brand_id);
    const bc = b?.color || '#9494AA';
    const camp = campaigns.find((c) => c.id === i.campaign_id);
    const cc = CHANNEL_COLOR[i.channel] || '#9494AA';
    const alreadyInProduction = promotedIdeaIds.has(i.id);
    viewingPanel = (
      <Modal title={i.title || 'Untitled'} subtitle="Idea detail" onClose={() => setViewing(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="ap-chip" style={{ background: bc + '22', color: bc }}>{b?.name || 'Unassigned'}</span>
            {camp && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>◆ {camp.name}</span>}
            {i.channel && <span className="ap-chip" style={{ background: cc + '22', color: cc }}>{i.channel}</span>}
            {i.format && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>{i.format}</span>}
            <Pill text={alreadyInProduction ? 'in production' : i.status} color={alreadyInProduction ? '#ffbb44' : (STATUS_COLOR[i.status] || '#9494AA')} />
          </div>

          <DateRow publish={i.publish_date} production={i.production_due} edit={i.edit_due} />

          {i.hook && <div><div style={cLbl}>Hook</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.hook}</div></div>}
          {i.caption && <div><div style={cLbl}>Caption</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.caption}</div></div>}
          {i.hashtags && <div><div style={cLbl}>Hashtags</div><div style={{ fontSize: 13, color: cc, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.hashtags}</div></div>}
          {i.mandatories && <div><div style={cLbl}>Mandatories</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.mandatories}</div></div>}
          {i.notes && <div><div style={cLbl}>Notes</div><div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{i.notes}</div></div>}

          {/carousel/i.test(i.format || '') && Array.isArray(i.carousel_slides) && i.carousel_slides.some(Boolean) && (
            <div>
              <div style={cLbl}>Carousel Slides</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {i.carousel_slides.map((s, idx) => s ? (
                  <div key={idx} style={{ fontSize: 12.5, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Slide {idx + 1}: </span>{s}
                  </div>
                ) : null)}
              </div>
            </div>
          )}

          {isCommand && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              {alreadyInProduction ? (
                <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>Already in Production →</span>
              ) : (
                <form action={promoteAction}>
                  <input type="hidden" name="idea_id" value={i.id} />
                  <input type="hidden" name="brand_id" value={i.brand_id || ''} />
                  <input type="hidden" name="campaign_id" value={i.campaign_id || ''} />
                  <input type="hidden" name="title" value={i.title || ''} />
                  <button className="btn bl" type="submit" disabled={promoting}>Promote to Production →</button>
                </form>
              )}
            </div>
          )}
        </div>
      </Modal>
    );
  }

  // Brand tab → status filter → the resulting list feeds both view modes.
  const brandFiltered = brandFilter === 'all' ? readyIdeas : readyIdeas.filter((i) => i.brand_id === brandFilter);
  const filtered = brandFiltered.filter((i) => {
    if (statusFilter === 'all') return true;
    const inProd = promotedIdeaIds.has(i.id);
    return statusFilter === 'production' ? inProd : !inProd;
  });
  const newCount = brandFiltered.filter((i) => !promotedIdeaIds.has(i.id)).length;
  const prodCount = brandFiltered.filter((i) => promotedIdeaIds.has(i.id)).length;

  return (
    <>
      {viewingPanel}

      <div className="ph">
        <div>
          <div className="pt">Ideas</div>
          <div className="ps">{readyIdeas.length} ready concept{readyIdeas.length === 1 ? '' : 's'} · fill more rows in the Content Bucket</div>
        </div>
        <div className="cvws">
          <div className={`cvw ${viewMode === 'grid' ? 'on' : ''}`} onClick={() => setViewMode('grid')}>▦ Grid</div>
          <div className={`cvw ${viewMode === 'table' ? 'on' : ''}`} onClick={() => setViewMode('table')}>☰ Table</div>
        </div>
      </div>

      {delState?.error && (
        <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464' }}>{delState.error}</div>
      )}

      {/* Brand tabs — only worth showing once there's more than one brand to split by. */}
      {brands.length > 1 && (
        <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 10 }}>
          <div className={`cvw ${brandFilter === 'all' ? 'on' : ''}`} onClick={() => setBrandFilter('all')}>All brands</div>
          {brands.map((b) => (
            <div key={b.id} className={`cvw ${brandFilter === b.id ? 'on' : ''}`} onClick={() => setBrandFilter(b.id)}
              style={brandFilter === b.id ? { color: b.color, background: b.color + '22' } : { color: b.color }}>{b.name}</div>
          ))}
        </div>
      )}

      {/* Status filter — New (not yet promoted) vs. already In Production. */}
      <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 16 }}>
        <div className={`cvw ${statusFilter === 'all' ? 'on' : ''}`} onClick={() => setStatusFilter('all')}>All ({brandFiltered.length})</div>
        <div className={`cvw ${statusFilter === 'new' ? 'on' : ''}`} onClick={() => setStatusFilter('new')}>New ({newCount})</div>
        <div className={`cvw ${statusFilter === 'production' ? 'on' : ''}`} onClick={() => setStatusFilter('production')} style={statusFilter === 'production' ? { color: '#ffbb44', background: '#ffbb4422' } : { color: '#ffbb44' }}>In Production ({prodCount})</div>
      </div>

      {filtered.length === 0 ? (
        <ComingSoon icon="◇" title="No ideas match this view" body={isCommand ? 'Fill rows in the Content Bucket, then flip one to Ready — it pops up here as a card.' : 'No ideas ready for your brand yet.'} />
      ) : viewMode === 'table' ? (
        <div className="sc" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                {['Title', 'Brand', 'Campaign', 'Channel', 'Format', 'Publish', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const b = brandById(i.brand_id);
                const bc = b?.color || '#9494AA';
                const cc = CHANNEL_COLOR[i.channel] || '#9494AA';
                const camp = campaigns.find((c) => c.id === i.campaign_id);
                const alreadyInProduction = promotedIdeaIds.has(i.id);
                return (
                  <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.title}>{i.title}</td>
                    <td style={{ padding: '8px 10px' }}><span style={{ fontSize: 10, fontWeight: 600, color: bc, background: bc + '1c', padding: '2px 7px', borderRadius: 5 }}>{b?.name || '—'}</span></td>
                    <td style={{ padding: '8px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{camp ? camp.name : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{i.channel ? <span style={{ fontSize: 10, fontWeight: 600, color: cc, background: cc + '1c', padding: '2px 7px', borderRadius: 5 }}>{i.channel}</span> : '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{i.format || '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{i.publish_date || '—'}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <Pill text={alreadyInProduction ? 'in production' : i.status} color={alreadyInProduction ? '#ffbb44' : (STATUS_COLOR[i.status] || '#9494AA')} />
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => setViewing(i)} title="View details">👁</button>
                        {isCommand && !alreadyInProduction && (
                          <form action={promoteAction}>
                            <input type="hidden" name="idea_id" value={i.id} />
                            <input type="hidden" name="brand_id" value={i.brand_id || ''} />
                            <input type="hidden" name="campaign_id" value={i.campaign_id || ''} />
                            <input type="hidden" name="title" value={i.title || ''} />
                            <button className="btn bg" type="submit" disabled={promoting} style={{ fontSize: 11, padding: '3px 7px', color: '#64BC46' }}>Promote →</button>
                          </form>
                        )}
                        {isCommand && (
                          <form action={deleteAction}><input type="hidden" name="id" value={i.id} />
                            <button className="btn bg" type="submit" disabled={deletingIdea} style={{ fontSize: 11, padding: '3px 7px', color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }}>🗑</button></form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {filtered.map((i) => {
            const b = brandById(i.brand_id);
            const bc = b?.color || '#9494AA';
            const cc = CHANNEL_COLOR[i.channel] || '#9494AA';
            const camp = campaigns.find((c) => c.id === i.campaign_id);
            const alreadyInProduction = promotedIdeaIds.has(i.id);
            return (
              <div key={i.id} className="sc" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{i.title}</div>
                  <Pill text={alreadyInProduction ? 'in production' : i.status} color={alreadyInProduction ? '#ffbb44' : (STATUS_COLOR[i.status] || '#9494AA')} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: bc, background: bc + '1c', padding: '2px 8px', borderRadius: 5 }}>{b?.name || 'Unassigned'}</span>
                  {camp && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 5 }}>◆ {camp.name}</span>}
                  {i.channel && <span style={{ fontSize: 11, fontWeight: 600, color: cc, background: cc + '1c', padding: '2px 8px', borderRadius: 5 }}>{i.channel}</span>}
                  {i.format && <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: 5 }}>{i.format}</span>}
                </div>
                {i.hook && <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}><b style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Hook</b><br />{i.hook}</div>}
                {i.caption && <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{i.caption}</div>}
                {i.hashtags && <div style={{ fontSize: 11, color: cc, lineHeight: 1.4 }}>{i.hashtags}</div>}
                {/carousel/i.test(i.format || '') && Array.isArray(i.carousel_slides) && i.carousel_slides.some(Boolean) && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                    <b style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Slides</b>
                    <br />
                    {i.carousel_slides.filter(Boolean).length}/5 filled
                  </div>
                )}
                <DateRow publish={i.publish_date} production={i.production_due} edit={i.edit_due} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <button type="button" className="btn bg" style={{ fontSize: 12 }} onClick={() => setViewing(i)}>👁 View</button>
                  {isCommand && (
                    alreadyInProduction ? (
                      <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>Already in Production →</span>
                    ) : (
                      <form action={promoteAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="idea_id" value={i.id} />
                        <input type="hidden" name="brand_id" value={i.brand_id || ''} />
                        <input type="hidden" name="campaign_id" value={i.campaign_id || ''} />
                        <input type="hidden" name="title" value={i.title || ''} />
                        <button className="btn bg" type="submit" disabled={promoting} style={{ fontSize: 12 }}>Promote to Production →</button>
                      </form>
                    )
                  )}
                  {isCommand && (
                    <form action={deleteAction} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className="btn bg" type="submit" disabled={deletingIdea} style={{ fontSize: 12, color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }}>🗑</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------ PRODUCTION
// Board columns come from content_items, plus one extra kind of card:
// ready ideas that haven't been promoted yet show up as virtual cards in
// Command Review (id-prefixed `idea:<uuid>` while dragging) so nothing an
// idea produces goes unseen by Command. Dropping one on any column — or
// clicking "Promote to Production" — creates the real content_item.
function ProductionView({ content, ideas = [], brands, campaigns, brandById, isCommand, canDelete = true, googleConnected = false }) {
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null); // card opened for detail (read-only)
  const [dragId, setDragId] = useState(null);    // card being dragged (real id, or 'idea:<id>')
  const [overCol, setOverCol] = useState(null);  // column currently hovered during drag
  const [state, formAction, pending] = useActionState(saveContent, {});
  const [, statusAction, statusBusy] = useActionState(setContentStatus, {});
  const [delState, deleteAction, deletingItem] = useActionState(deleteContent, {});
  const [attState, attAction, attBusy] = useActionState(setContentAttachments, {});
  const [, promoteAction, promoting] = useActionState(promoteIdeaToProduction, {});

  // Ready ideas that don't have a content_item yet — these are the virtual
  // Command Review cards.
  const promotedIdeaIds = new Set(content.filter((c) => c.idea_id).map((c) => c.idea_id));
  const pendingIdeaCards = ideas.filter((i) => i.ready && !promotedIdeaIds.has(i.id));

  function promoteVirtual(idea, status) {
    const fd = new FormData();
    fd.set('idea_id', idea.id);
    fd.set('brand_id', idea.brand_id || '');
    fd.set('campaign_id', idea.campaign_id || '');
    fd.set('title', idea.title || '');
    fd.set('status', status);
    promoteAction(fd);
  }

  // Drive folder provisioning (for the open detail card).
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderErr, setFolderErr] = useState('');

  // Ask the server to create/find this card's Drive folder, then reflect the
  // returned URL in the open detail view without a full reload.
  async function provisionFolder(item) {
    setFolderErr('');
    setFolderBusy(true);
    try {
      const res = await fetch('/api/google/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the folder.');
      setViewing((v) => (v && v.id === item.id
        ? { ...v, drive_folder_url: data.url, drive_folder_id: data.id }
        : v));
    } catch (e) {
      setFolderErr(e.message || 'Could not create the folder.');
    } finally {
      setFolderBusy(false);
    }
  }

  // Draft state for the attachments editor (in the detail view).
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');

  useEffect(() => { if (state?.ok) setEditing(null); }, [state?.ok]);

  const COLS = [
    { id: 'command_review', label: 'Command Review', color: '#EE268C' },
    { id: 'in_production', label: 'In Production', color: '#ffbb44' },
    { id: 'review', label: 'In Review', color: '#78b8e8' },
    { id: 'approved', label: 'Approved', color: '#64BC46' },
  ];
  const nextOf = { command_review: 'in_production', in_production: 'review', review: 'approved' };
  const prevOf = { in_production: 'command_review', review: 'in_production', approved: 'review' };
  const colById = (id) => COLS.find((c) => c.id === id);

  // Move a card to a new status by submitting the existing server action.
  function moveTo(id, status) {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('status', status);
    statusAction(fd);
  }

  // Persist a new attachments array for a content item, and reflect it
  // immediately in the open detail view.
  function saveAttachments(item, list) {
    const fd = new FormData();
    fd.set('id', item.id);
    fd.set('attachments', JSON.stringify(list));
    attAction(fd);
    setViewing((v) => (v && v.id === item.id ? { ...v, attachments: list } : v));
  }
  function addLink(item) {
    const url = linkUrl.trim();
    if (!url) return;
    const next = [...(item.attachments || []), { type: 'link', url, name: linkName.trim() }];
    saveAttachments(item, next);
    setLinkUrl('');
    setLinkName('');
  }
  function removeLink(item, idx) {
    const next = (item.attachments || []).filter((_, i) => i !== idx);
    saveAttachments(item, next);
  }
  function onDrop(colId) {
    if (dragId) {
      if (typeof dragId === 'string' && dragId.startsWith('idea:')) {
        const idea = ideas.find((x) => x.id === dragId.slice(5));
        if (idea) promoteVirtual(idea, colId);
      } else {
        const item = content.find((c) => c.id === dragId);
        if (item && item.status !== colId) moveTo(dragId, colId);
      }
    }
    setDragId(null);
    setOverCol(null);
  }

  if (viewing) {
    const c = viewing;
    const b = brandById(c.brand_id);
    const bc = b?.color || '#9494AA';
    const st = colById(c.status) || COLS[0];
    const linkedIdea = ideas.find((x) => x.id === c.idea_id);
    const camp = campaigns.find((x) => x.id === c.campaign_id);
    const cc = linkedIdea ? (CHANNEL_COLOR[linkedIdea.channel] || '#9494AA') : '#9494AA';
    return (
      <>
        <div className="ph">
          <div><div className="pt">{c.title || 'Untitled'}</div><div className="ps">Content detail</div></div>
          <button type="button" className="btn bg" onClick={() => setViewing(null)}>← Back to board</button>
        </div>
        <div className="sc" style={{ padding: 22, maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="ap-chip" style={{ background: bc + '22', color: bc }}>{b?.name || 'Unassigned'}</span>
            <span className="ap-chip" style={{ background: st.color + '22', color: st.color }}>● {st.label}</span>
            {camp && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>◆ {camp.name}</span>}
            {linkedIdea?.pillar && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>{linkedIdea.pillar}</span>}
            {linkedIdea?.channel && <span className="ap-chip" style={{ background: cc + '22', color: cc }}>{linkedIdea.channel}</span>}
            {linkedIdea?.format && <span className="ap-chip" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>{linkedIdea.format}</span>}
          </div>

          {linkedIdea && (linkedIdea.publish_date || linkedIdea.production_due || linkedIdea.edit_due) && (
            <DateRow publish={linkedIdea.publish_date} production={linkedIdea.production_due} edit={linkedIdea.edit_due} />
          )}

          <div>
            <div style={cLbl}>Body / copy</div>
            <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {c.body || <span style={{ color: 'var(--text3)' }}>No copy yet.</span>}
            </div>
          </div>

          {/* Everything below comes from the source idea (Content Bucket), so
              production has the full brief without needing to switch pages —
              only shows up when the card is still linked to that idea. */}
          {linkedIdea ? (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>From idea: {linkedIdea.title}</div>
              {linkedIdea.hook && <div><div style={cLbl}>Hook</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{linkedIdea.hook}</div></div>}
              {linkedIdea.caption && <div><div style={cLbl}>Caption</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{linkedIdea.caption}</div></div>}
              {linkedIdea.hashtags && <div><div style={cLbl}>Hashtags</div><div style={{ fontSize: 13, color: cc, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{linkedIdea.hashtags}</div></div>}
              {linkedIdea.mandatories && <div><div style={cLbl}>Mandatories</div><div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{linkedIdea.mandatories}</div></div>}
              {linkedIdea.notes && <div><div style={cLbl}>Notes</div><div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{linkedIdea.notes}</div></div>}
              {/carousel/i.test(linkedIdea.format || '') && Array.isArray(linkedIdea.carousel_slides) && linkedIdea.carousel_slides.some(Boolean) && (
                <div>
                  <div style={cLbl}>Carousel Slides</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {linkedIdea.carousel_slides.map((s, idx) => s ? (
                      <div key={idx} style={{ fontSize: 12.5, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <span style={{ color: 'var(--text3)', fontWeight: 600 }}>Slide {idx + 1}: </span>{s}
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}
              {!linkedIdea.hook && !linkedIdea.caption && !linkedIdea.hashtags && !linkedIdea.mandatories && !linkedIdea.notes && (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>The linked idea has no additional details filled in.</div>
              )}
            </div>
          ) : (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, fontSize: 12, color: 'var(--text3)' }}>
              Not linked to a Content Bucket idea — either created directly in Production, or its source idea was deleted (this card's own title/copy/campaign are unaffected).
            </div>
          )}

          {/* Attachments — Google Drive links for submission. Command + freelance. */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={cLbl}>Attachments · Google Drive links</div>

            {/* Artist upload target — auto-provisioned Drive folder for this card. */}
            {c.drive_folder_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#64BC4618', border: '1px solid #64BC4655', borderRadius: 10, padding: '11px 13px', marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>📁</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#64BC46' }}>Artist uploads here</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.drive_folder_url}>{c.drive_folder_url}</div>
                </div>
                <a href={c.drive_folder_url} target="_blank" rel="noreferrer" className="btn bl" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>Open folder ↗</a>
              </div>
            ) : googleConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: 10, padding: '11px 13px', marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>📁</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)' }}>Artist upload folder</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Create a dedicated Drive folder so the artist knows exactly where to upload.</div>
                </div>
                {isCommand && (
                  <button type="button" className={`btn bl ${folderBusy ? 'loading' : ''}`} disabled={folderBusy} onClick={() => provisionFolder(c)} style={{ whiteSpace: 'nowrap' }}>
                    {folderBusy ? 'Creating…' : '✦ Create folder'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px dashed var(--border)', borderRadius: 10, padding: '11px 13px', marginBottom: 14 }}>
                Connect Google Drive {isCommand ? <>(<a href="/api/google/connect" style={{ color: '#64BC46' }}>connect now</a>)</> : ''} to auto-create an upload folder for each card.
              </div>
            )}
            {folderErr && <div style={{ fontSize: 12, color: '#ff6464', marginBottom: 12 }}>{folderErr}</div>}

            {(c.attachments || []).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>No files attached yet. Paste a Google Drive share link below.</div>
            )}
            {(c.attachments || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {(c.attachments || []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
                    <span style={{ fontSize: 14 }}>🔗</span>
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12.5, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.url}>
                      {a.name || a.url}
                    </a>
                    <button type="button" className="btn bg" disabled={attBusy} onClick={() => removeLink(c, i)} style={{ fontSize: 11, padding: '3px 8px', color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 260px' }}>
                <input style={cInp} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://drive.google.com/…"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(c); } }} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <input style={cInp} value={linkName} onChange={(e) => setLinkName(e.target.value)}
                  placeholder="Label (optional)"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(c); } }} />
              </div>
              <button type="button" className={`btn bl ${attBusy ? 'loading' : ''}`} disabled={attBusy || !linkUrl.trim()} onClick={() => addLink(c)}>＋ Add link</button>
            </div>
            {attState?.error && <div style={{ fontSize: 12, color: '#ff6464', marginTop: 8 }}>{attState.error}</div>}
          </div>

          {isCommand && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button type="button" className="btn bl" onClick={() => { setViewing(null); setEditing(c); }}>✎ Edit</button>
              {prevOf[c.status] && (
                <button type="button" className={`btn bg ${statusBusy ? 'loading' : ''}`} disabled={statusBusy} onClick={() => { moveTo(c.id, prevOf[c.status]); setViewing({ ...c, status: prevOf[c.status] }); }}>← {colById(prevOf[c.status])?.label}</button>
              )}
              {nextOf[c.status] && (
                <button type="button" className={`btn bg ${statusBusy ? 'loading' : ''}`} disabled={statusBusy} style={{ color: '#64BC46' }} onClick={() => { moveTo(c.id, nextOf[c.status]); setViewing({ ...c, status: nextOf[c.status] }); }}>{colById(nextOf[c.status])?.label} →</button>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  if (editing) {
    const c = editing;
    return (
      <>
        <div className="ph">
          <div><div className="pt">{c.id ? 'Edit content' : 'New content'}</div><div className="ps">A piece being produced from an idea</div></div>
          <button type="button" className="btn bg" onClick={() => setEditing(null)}>← Back</button>
        </div>
        {state?.error && <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464' }}>{state.error}</div>}
        <form action={formAction} className="sc" style={{ padding: 22, maxWidth: 680 }}>
          {c.id && <input type="hidden" name="id" value={c.id} />}
          <CField label="Title"><input style={cInp} name="title" defaultValue={c.title || ''} placeholder="What is this piece?" /></CField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <CField label="Brand">
              <select style={cInp} name="brand_id" defaultValue={c.brand_id || brands[0]?.id || ''}>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </CField>
            <CField label="Status">
              <select style={cInp} name="status" defaultValue={c.status || 'command_review'}>
                <option value="command_review">Command Review</option><option value="in_production">In Production</option><option value="review">In Review</option><option value="approved">Approved</option>
              </select>
            </CField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <CField label="From idea (optional)">
              <select style={cInp} name="idea_id" defaultValue={c.idea_id || ''}>
                <option value="">— none —</option>
                {ideas.map((i) => <option key={i.id} value={i.id}>{i.title}{i.channel ? ' · ' + i.channel : ''}</option>)}
              </select>
            </CField>
            <CField label="Campaign (optional)">
              <select style={cInp} name="campaign_id" defaultValue={c.campaign_id || ''}>
                <option value="">— none —</option>
                {campaigns.map((cm) => <option key={cm.id} value={cm.id}>{cm.name}</option>)}
              </select>
            </CField>
          </div>
          <CField label="Body / copy"><textarea style={cTa(140)} name="body" defaultValue={c.body || ''} placeholder="Caption, script, or working copy." /></CField>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={`btn bl ${pending ? 'loading' : ''}`} type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
            <button className="btn bg" type="button" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="ph">
        <div><div className="pt">Production</div><div className="ps">{content.length} items in production · move work to review and approval</div></div>
        {isCommand && <button type="button" className="btn bl" onClick={() => setEditing({})}>＋ New content</button>}
      </div>

      {(state?.error || delState?.error) && (
        <div className="ap-note" style={{ borderColor: 'rgba(255,100,100,.35)', color: '#ff6464' }}>{state?.error || delState?.error}</div>
      )}

      {isCommand && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
          Drag a card between columns to change its status, or click it to view details.
        </div>
      )}

      <div className="ap-board" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {COLS.map((col) => {
          const items = content.filter((c) => c.status === col.id);
          const isOver = overCol === col.id && dragId;
          return (
            <div
              className="ap-col"
              key={col.id}
              onDragOver={isCommand ? (e) => { e.preventDefault(); if (overCol !== col.id) setOverCol(col.id); } : undefined}
              onDragLeave={isCommand ? (e) => { if (e.currentTarget === e.target) setOverCol((o) => (o === col.id ? null : o)); } : undefined}
              onDrop={isCommand ? (e) => { e.preventDefault(); onDrop(col.id); } : undefined}
              style={isOver ? { outline: `2px dashed ${col.color}`, outlineOffset: -2, background: col.color + '0d', borderRadius: 12 } : {}}
            >
              <div className="ap-col-hd">
                <span className="ap-col-dot" style={{ background: col.color }} />
                <span className="ap-col-t" style={{ color: col.color }}>{col.label}</span>
                <span className="ap-col-n">{items.length + (col.id === 'command_review' ? pendingIdeaCards.length : 0)}</span>
              </div>
              <div className="ap-col-bd">
                {items.length === 0 && (col.id !== 'command_review' || pendingIdeaCards.length === 0) && <div className="ap-empty">{isOver ? 'Drop here' : '—'}</div>}
                {col.id === 'command_review' && pendingIdeaCards.map((idea) => {
                  const b = brandById(idea.brand_id);
                  const bc = b?.color || '#9494AA';
                  const dragKey = 'idea:' + idea.id;
                  const isDragging = dragId === dragKey;
                  return (
                    <div
                      className="ap-card"
                      key={dragKey}
                      draggable={isCommand}
                      onDragStart={isCommand ? (e) => { setDragId(dragKey); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                      onDragEnd={isCommand ? () => { setDragId(null); setOverCol(null); } : undefined}
                      style={{ cursor: isCommand ? 'grab' : 'default', opacity: isDragging ? 0.4 : 1, transition: 'opacity .12s', border: '1px dashed var(--border)' }}
                      title="Not yet in production · drag to promote, or use the button below"
                    >
                      <div className="ap-card-t">{idea.title}</div>
                      <div className="ap-card-m">
                        <span className="ap-chip" style={{ background: bc + '22', color: bc }}>{b?.name || 'Unassigned'}</span>
                        <span className="ap-chip" style={{ background: 'var(--bg2)', color: 'var(--text3)', marginLeft: 6 }}>◇ Idea</span>
                      </div>
                      {isCommand && (
                        <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn bg" disabled={promoting} style={{ fontSize: 11, padding: '3px 7px', color: '#64BC46' }} onClick={() => promoteVirtual(idea, 'command_review')}>Promote to Production →</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {items.map((i) => {
                  const b = brandById(i.brand_id);
                  const bc = b?.color || '#9494AA';
                  const isDragging = dragId === i.id;
                  return (
                    <div
                      className="ap-card"
                      key={i.id}
                      draggable={isCommand}
                      onDragStart={isCommand ? (e) => { setDragId(i.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                      onDragEnd={isCommand ? () => { setDragId(null); setOverCol(null); } : undefined}
                      onClick={() => setViewing(i)}
                      style={{ cursor: 'pointer', opacity: isDragging ? 0.4 : 1, transition: 'opacity .12s, box-shadow .12s', ...(isCommand ? {} : {}) }}
                      title="Click to open · drag to move"
                    >
                      <div className="ap-card-t">{i.title}</div>
                      {i.body && <div style={{ fontSize: 11, color: 'var(--text3)', margin: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{i.body}</div>}
                      <div className="ap-card-m"><span className="ap-chip" style={{ background: bc + '22', color: bc }}>{b?.name || 'Unassigned'}</span>{(i.attachments || []).length > 0 && <span className="ap-chip" style={{ background: 'var(--bg2)', color: 'var(--text3)', marginLeft: 6 }}>🔗 {(i.attachments || []).length}</span>}</div>
                      <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => setViewing(i)}>👁 View</button>
                      </div>
                      {isCommand && (
                        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {prevOf[i.status] && (
                            <form action={statusAction}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value={prevOf[i.status]} />
                              <button className="btn bg" type="submit" disabled={statusBusy} style={{ fontSize: 11, padding: '3px 7px' }}>←</button></form>
                          )}
                          {nextOf[i.status] && (
                            <form action={statusAction}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value={nextOf[i.status]} />
                              <button className="btn bg" type="submit" disabled={statusBusy} style={{ fontSize: 11, padding: '3px 7px', color: col.color === '#64BC46' ? undefined : '#64BC46' }}>Advance →</button></form>
                          )}
                          <button type="button" className="btn bg" style={{ fontSize: 11, padding: '3px 7px' }} onClick={() => setEditing(i)}>✎</button>
                          {canDelete && (
                            <form action={deleteAction}><input type="hidden" name="id" value={i.id} />
                              <button className="btn bg" type="submit" disabled={deletingItem} style={{ fontSize: 11, padding: '3px 7px', color: '#ff6464', borderColor: 'rgba(255,100,100,.35)' }}>🗑</button></form>
                          )}
                        </div>
                      )}
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
// PUBLISHING CENTER — calendar of scheduled content across channels
// =====================================================================
function PublishingCenter({ content, ideas = [], brands, brandColor, subView }) {
  if (subView === 'channels') {
    return <ChannelsView ideas={ideas} brands={brands} brandColor={brandColor} />;
  }
  const brandById = (id) => brands.find((b) => b.id === id) || null;
  const now = new Date();
  const [view, setView] = useState('month');
  // Brand filter: 'all' shows everything; otherwise a brand id scopes the calendar.
  const [brandFilter, setBrandFilter] = useState('all');
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // The calendar plots what's actually scheduled to publish, which lives on
  // ideas.publish_date (content_items has no publish date, channel, or brand
  // name field of its own — those only exist on the idea it came from).
  const scoped = brandFilter === 'all'
    ? ideas
    : ideas.filter((i) => i.brand_id === brandFilter);

  // map ideas with a publish date in this month → day number
  const events = {};
  scoped.forEach((i) => {
    if (!i.publish_date) return;
    const d = new Date(i.publish_date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      (events[day] = events[day] || []).push(i);
    }
  });

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const scheduled = scoped.filter((i) => i.publish_date).sort((a, b) => (a.publish_date < b.publish_date ? -1 : 1));

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

      {/* Brand filter — view everything at once, or scope the calendar to one brand */}
      <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 16 }}>
        <div
          className={`cvw ${brandFilter === 'all' ? 'on' : ''}`}
          onClick={() => setBrandFilter('all')}
        >
          All Brands
        </div>
        {brands.map((b) => {
          const on = brandFilter === b.id;
          return (
            <div
              key={b.id}
              className={`cvw ${on ? 'on' : ''}`}
              onClick={() => setBrandFilter(b.id)}
              style={on ? { color: b.color, background: (b.color || '#9494AA') + '22' } : { color: b.color }}
            >
              {b.name}
            </div>
          );
        })}
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
                {d && (events[d] || []).map((e) => {
                  const b = brandById(e.brand_id);
                  const cc = CHANNEL_COLOR[e.channel] || (b?.color || '#9494AA');
                  return (
                    <div
                      className="cev"
                      key={e.id}
                      title={e.channel ? `${e.title} · ${e.channel}` : e.title}
                      style={{ background: cc + '2e', color: cc }}
                    >
                      {e.title}
                    </div>
                  );
                })}
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
          {scheduled.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Nothing scheduled.</div>
          )}
          {scheduled.map((i) => {
            const b = brandById(i.brand_id);
            const bc = b?.color || '#9494AA';
            const cc = CHANNEL_COLOR[i.channel] || '#9494AA';
            return (
              <div className="tr" key={i.id} style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr' }}>
                <div className="tdt">{i.title}</div>
                <div className="td"><span className="sb2" style={{ background: bc + '22', color: bc }}>{b?.name || 'Unassigned'}</span></div>
                <div className="td">{i.channel ? <span className="sb2" style={{ background: cc + '22', color: cc }}>{i.channel}</span> : '—'}</div>
                <div className="td">{i.publish_date || '—'}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// =====================================================================
// CHANNELS VIEW — pick a platform, see content lined up per brand
// =====================================================================
function ChannelsView({ ideas = [], brands, brandColor }) {
  const PLATFORMS = ['TikTok', 'Instagram', 'Threads', 'Facebook', 'YouTube', 'Blog'];
  const [platform, setPlatform] = useState('Instagram');

  // All ideas on the selected platform — channel/publish_date only exist on
  // ideas, not content_items, so this rolls up from the Content Bucket data.
  const onPlatform = ideas.filter((i) => i.channel === platform);

  // Per-brand rollup: scheduled (has a publish date), in production (ready
  // but no publish date yet), total.
  const rows = brands.map((b) => {
    const items = onPlatform.filter((i) => i.brand_id === b.id);
    const scheduled = items.filter((i) => i.publish_date).length;
    const total = items.length;
    const inProd = total - scheduled;
    return { brand: b.name, color: b.color || brandColor(b.name), scheduled, inProd, total };
  }).sort((a, b) => b.total - a.total);

  const grand = rows.reduce((s, r) => s + r.total, 0);
  const cc = CHANNEL_COLOR[platform] || '#9494AA';

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">Channels</div>
          <div className="ps">Pick a platform to see how much content is lined up per brand</div>
        </div>
      </div>

      {/* Platform selector */}
      <div className="cvws" style={{ display: 'flex', flexWrap: 'wrap', width: 'fit-content', maxWidth: '100%', marginBottom: 16 }}>
        {PLATFORMS.map((p) => {
          const on = platform === p;
          const pc = CHANNEL_COLOR[p] || '#9494AA';
          return (
            <div
              key={p}
              className={`cvw ${on ? 'on' : ''}`}
              onClick={() => setPlatform(p)}
              style={on ? { color: pc, background: pc + '22' } : { color: pc }}
            >
              {p}
            </div>
          );
        })}
      </div>

      {/* Per-brand table for the selected platform */}
      <div className="ctbl">
        <div className="tblh" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr' }}>
          <div className="th">Brand</div>
          <div className="th">In Production</div>
          <div className="th">Scheduled</div>
          <div className="th">Total Lined Up</div>
        </div>
        {grand === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No content on {platform} yet.
          </div>
        )}
        {grand > 0 && rows.map((r) => (
          <div className="tr" key={r.brand} style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr' }}>
            <div className="tdt"><span className="sb2" style={{ background: r.color + '22', color: r.color }}>{r.brand}</span></div>
            <div className="td">{r.inProd}</div>
            <div className="td">{r.scheduled}</div>
            <div className="td" style={{ fontWeight: 700, color: cc }}>{r.total}</div>
          </div>
        ))}
        {grand > 0 && (
          <div className="tr" style={{ gridTemplateColumns: '2.5fr 1fr 1fr 1fr', borderTop: '1px solid var(--border)' }}>
            <div className="tdt" style={{ color: 'var(--text3)', fontWeight: 600 }}>All brands</div>
            <div className="td">{rows.reduce((s, r) => s + r.inProd, 0)}</div>
            <div className="td">{rows.reduce((s, r) => s + r.scheduled, 0)}</div>
            <div className="td" style={{ fontWeight: 700, color: cc }}>{grand}</div>
          </div>
        )}
      </div>
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
