'use client';

import { useState, useActionState } from 'react';
import appConfig from '../config/app.json';
import { saveBrand, archiveBrand } from '../app/dashboard/brand-actions';

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

  const sections = [...new Set(visibleNav.map((n) => n.section))];
  const isCommand = role === 'command';

  // Brand color lookup: prefer live DB brands, fall back to config map.
  const brandColor = (name) => {
    const b = brands.find((x) => x.name === name);
    return (b && b.color) || BRAND_COLOR[name] || '#9494AA';
  };

  // content is already scoped by RLS; this is just for display grouping
  const byStatus = (s) => content.filter((c) => c.status === s);
  const pendingCount = content.filter((c) => ['submitted', 'changes'].includes(c.status)).length;

  function go(id) {
    setActive(id);
    setDrawer(false);
  }

  const navColorClass = { cont: 'g', pub: 'b', anly: 'y' };

  return (
    <>
      <div className="mtop">
        <div className="mtop-burger" onClick={() => setDrawer((d) => !d)}>☰</div>
        <div className="mtop-name">{NAV.find((n) => n.id === active)?.label}</div>
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
                const on = active === n.id;
                const cls = on ? `ni on ${navColorClass[n.id] || ''}` : 'ni';
                return (
                  <div className={cls} key={n.id} onClick={() => go(n.id)}>
                    <span className="ni-ic">{n.icon}</span> {n.label}
                    {n.pill && <span className="ni-pill">{n.pill}</span>}
                    {n.id === 'appr' && pendingCount > 0 && (
                      <span className="ni-pill" style={{ background: 'rgba(255,187,68,.15)', color: '#ffbb44', borderColor: 'rgba(255,187,68,.3)' }}>
                        {pendingCount}
                      </span>
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
            <div className="tb-title">{NAV.find((n) => n.id === active)?.label}</div>
            <div className="tb-search"><span>⌕</span><span>Search everything…</span><span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 3 }}>⌘K</span></div>
            <div className="tb-acts">
              {isCommand && <button className="btn bg">⊕ New Asset</button>}
              <button className="btn bl">✦ Ask the OS</button>
            </div>
          </div>

          <div className="content">
            {active === 'dash' && (
              <Dashboard profile={profile} content={content} isCommand={isCommand} pendingCount={pendingCount} />
            )}

            {active === 'appr' && (
              <Approvals
                content={content}
                role={role}
                brandScope={profile.brand_scope}
                byStatus={byStatus}
                brandColor={brandColor}
              />
            )}

            {active === 'brand' && (
              <BrandCenter brands={brands} isCommand={isCommand} content={content} />
            )}

            {active === 'cont' && (
              <ContentCenter content={content} brands={brands} brandColor={brandColor} />
            )}

            {active === 'pub' && (
              <PublishingCenter content={content} brands={brands} brandColor={brandColor} />
            )}

            {active === 'anly' && (
              <AnalyticsCenter content={content} brands={brands} brandColor={brandColor} />
            )}

            {!['dash', 'appr', 'brand', 'cont', 'pub', 'anly'].includes(active) && (
              <Stub label={NAV.find((n) => n.id === active)?.label} />
            )}
          </div>
        </main>
      </div>
    </>
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
          <div>
            <div className="pt" style={{ color: open.color }}>{open.name}</div>
            <div className="ps">{open.tagline}{open.category ? ` · ${open.category}` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isCommand && <button className="btn bg" onClick={() => openEdit(open)}>✎ Edit</button>}
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

  // When the save succeeds, return to the list.
  if (state?.ok) {
    // schedule the transition out of render
    setTimeout(onDone, 0);
  }

  const palette = ['#EE268C', '#64BC46', '#AED8FF', '#FFAEF1', '#DDEE26'];
  const lbl = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 6, display: 'block' };
  const inp = { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: "'Inter',sans-serif" };

  return (
    <>
      <div className="ph">
        <div>
          <div className="pt">{brand ? 'Edit Brand' : 'New Brand'}</div>
          <div className="ps">{brand ? 'Update this brand’s identity' : 'Add a brand to your Creative OS'}</div>
        </div>
        <button className="btn bg" onClick={onCancel}>← Cancel</button>
      </div>

      <form action={formAction} style={{ maxWidth: 680 }}>
        {brand?.id && <input type="hidden" name="id" value={brand.id} />}
        <input type="hidden" name="color" value={color} />

        <div className="card" style={{ padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Brand Name *</label>
            <input style={inp} name="name" defaultValue={brand?.name || ''} placeholder="e.g. OH HEY THERE Matcha Cafe" required />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Tagline</label>
            <input style={inp} name="tagline" defaultValue={brand?.tagline || ''} placeholder="Short descriptor" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Category</label>
            <input style={inp} name="category" defaultValue={brand?.category || ''} placeholder="e.g. Specialty Cafe, Tea Line, Apparel" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Mission</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} name="mission" defaultValue={brand?.mission || ''} placeholder="What this brand exists to do." />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Positioning</label>
            <input style={inp} name="positioning" defaultValue={brand?.positioning || ''} placeholder="One sentence: who you are for whom." />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Target Audience</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} name="audience" defaultValue={brand?.audience || ''} placeholder="Who you're speaking to." />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Brand Personality</label>
            <input style={inp} name="personality" defaultValue={(brand?.personality || []).join(', ')} placeholder="e.g. Curious, Warm, Confident, Playful" />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>Comma-separated traits.</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Brand Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {palette.map((c) => (
                <div
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer', border: color === c ? '2px solid var(--text)' : '2px solid transparent' }}
                />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 36, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{color}</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Brand Voice</label>
            <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} name="voice" defaultValue={brand?.voice || ''} placeholder="How this brand speaks — tone, personality, attitude." />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Style Guidelines</label>
            <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} name="style_guide" defaultValue={brand?.style_guide || ''} placeholder="Visual rules — colors, type, imagery, do’s and don’ts." />
          </div>

          <div style={{ marginBottom: 4 }}>
            <label style={lbl}>Approved Messaging</label>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} name="messaging" defaultValue={(brand?.messaging || []).join('\n')} placeholder="One pillar per line (or comma-separated)" />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>One messaging pillar per line.</div>
          </div>
        </div>

        {state?.error && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,100,100,.12)', border: '1px solid rgba(255,100,100,.3)', borderRadius: 'var(--rs)', color: '#ff6464', fontSize: 13 }}>
            {state.error}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn bl" type="submit" disabled={pending}>
            {pending ? 'Saving…' : brand ? 'Save changes' : 'Create brand'}
          </button>
          <button className="btn bg" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </>
  );
}

// =====================================================================
// CONTENT CENTER — visual planning: board / table views, team & cadence
// =====================================================================
function ContentCenter({ content, brands, brandColor }) {
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
function PublishingCenter({ content, brands, brandColor }) {
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
function AnalyticsCenter({ content, brands, brandColor }) {
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
