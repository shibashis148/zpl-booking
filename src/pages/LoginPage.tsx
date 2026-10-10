import { ArrowRight, Eye, EyeSlash, LockSimple, EnvelopeSimple, Spinner, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(localStorage.getItem('zpl_remember_email') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(localStorage.getItem('zpl_remember_device') === '1');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (ready && user) navigate('/new', { replace: true }); }, [navigate, ready, user]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await login(email, password, remember); if (remember) localStorage.setItem('zpl_remember_email', email.trim()); navigate('/new', { replace: true }); }
    catch (value) { setError(value instanceof Error ? value.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  };
  return <div className="grid min-h-screen bg-navy lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden overflow-hidden p-14 lg:flex lg:flex-col">
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #c7a44b 0, transparent 32%), radial-gradient(circle at 80% 80%, #31506f 0, transparent 34%)' }} />
      <div className="relative"><Brand /></div>
      <div className="relative my-auto max-w-xl"><span className="pill border border-gold/20 bg-gold/10 text-gold">Built for booking teams</span><h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.12] text-white">From enquiry to paid ride, in one calm workspace.</h1><p className="mt-5 max-w-lg text-base leading-7 text-slate-400">Create and assign trips, notify drivers, issue invoices and share secure CCAvenue payment links without leaving the booking desk.</p></div>
      <p className="relative text-xs text-slate-600">© 2026 Z Plus Limousine LLC · Dubai, UAE</p>
    </section>
    <section className="flex items-center justify-center bg-white px-6 py-12"><div className="w-full max-w-sm">
      <div className="mb-9 lg:hidden"><Brand dark={false} /></div>
      <h2 className="font-display text-3xl font-extrabold text-ink">Welcome back</h2><p className="mt-2 text-sm text-slate-500">Admin and booking manager access only.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label><span className="label">Email address</span><div className="relative"><EnvelopeSimple className="absolute left-3.5 top-3.5 text-slate-400" size={19} /><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field pl-11" placeholder="bookings@zpluslimo.com" /></div></label>
        <label><span className="label">Password</span><div className="relative"><LockSimple className="absolute left-3.5 top-3.5 text-slate-400" size={19} /><input required type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="field pl-11 pr-11" /><button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-3.5 text-slate-400">{show ? <EyeSlash /> : <Eye />}</button></div></label>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-gold" /> Remember this device</label>
        {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><WarningCircle size={19} />{error}</div>}
        <button disabled={busy} className="btn-primary h-12 w-full">{busy ? <><Spinner className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight weight="bold" /></>}</button>
      </form>
      <p className="mt-7 text-center text-xs text-slate-400">Accounts are created by an administrator in the main Z Plus dashboard.</p>
    </div></section>
  </div>;
}
