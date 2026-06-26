'use client';

import { useState } from 'react';
import appConfig from '../config/app.json';

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

export default function StudioShell({ profile, email, content }) {
  const role = profile.role === 'command' ? 'command' : 'freelance';
  const visibleNav = NAV.filter((n) => n.roles.includes(role));
  const [active, setActive] = useState('dash');
  const [drawer, setDrawer] = useState(false);

  const sections = [...new Set(visibleNav.map((n) => n.section))];
  const isCommand = role === 'command';

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
              />
            )}

            {!['dash', 'appr'].includes(active) && (
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

function Approvals({ content, role, brandScope, byStatus }) {
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
                  const bc = BRAND_COLOR[i.brand] || '#9494AA';
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

function Stub({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>◌</div>
      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13 }}>Coming in next build</div>
    </div>
  );
}
