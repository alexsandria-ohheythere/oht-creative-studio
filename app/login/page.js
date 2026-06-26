'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignIn(e) {
    e.preventDefault();
    setMsg(null);
    if (!email || !password) {
      setMsg({ type: 'err', text: 'Enter your email and password.' });
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMsg({ type: 'err', text: error.message });
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="lm">OH HEY THERE Corp.</div>
          <div className="ln">Creative Studio</div>
          <div className="lb">Creative OS</div>
        </div>

        <form onSubmit={handleSignIn}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ohheythere.com"
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {msg && <div className={`login-msg ${msg.type}`}>{msg.text}</div>}

        <div className="login-hint">
          Accounts are created by an admin in Supabase.<br />
          Trouble signing in? Contact Alex or CJ.
        </div>
      </div>
    </div>
  );
}
