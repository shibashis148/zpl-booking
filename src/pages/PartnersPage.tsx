import { Buildings, CheckCircle, MagnifyingGlass, PencilSimple, Plus, Spinner, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPartner, listPartners, updatePartner, type Partner } from '../services/api';

type PartnerDraft = Omit<Partner, 'id' | 'contactsCount'>;

const emptyPartner: PartnerDraft = {
  name: '',
  partner_type: 'corporate',
  email: null,
  phone: null,
  address: null,
  representative: null,
  billing_email: null,
  tax_id: null,
  notes: null,
  is_active: true,
};

export default function PartnersPage() {
  const [rows, setRows] = useState<Partner[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Partner | 'new' | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try { setRows((await listPartners(false)).items); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load partners.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => [row.name, row.representative, row.phone, row.email, row.billing_email, row.partner_type].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [query, rows]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-gold-dark">Relationships</p><h1 className="mt-1 font-display text-3xl font-extrabold">Partners</h1><p className="mt-2 text-sm text-slate-500">Hotels, corporate accounts and travel partners available during booking.</p></div>
      <button onClick={() => setEditing('new')} className="btn-gold"><Plus weight="bold" /> Add partner</button>
    </div>
    {message && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle />{message}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="card p-4"><div className="relative"><MagnifyingGlass className="absolute left-3.5 top-3 text-slate-400" /><input className="field py-2.5 pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, representative, email or phone" /></div></div>
    {loading ? <div className="grid min-h-64 place-items-center"><Spinner className="animate-spin text-gold-dark" size={28} /></div> : visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((row) => <article key={row.id} className="card p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-dark"><Buildings size={22} weight="duotone" /></div><div className="min-w-0"><h2 className="truncate font-display font-bold">{row.name}</h2><p className="text-xs capitalize text-slate-500">{row.partner_type.replaceAll('_', ' ')}</p></div></div><span className={`pill ${row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></div>
        <dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-400">Representative</dt><dd className="truncate font-semibold">{row.representative || '—'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">Phone</dt><dd className="truncate font-semibold">{row.phone || '—'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">Billing</dt><dd className="truncate font-semibold">{row.billing_email || row.email || '—'}</dd></div></dl>
        <button onClick={() => setEditing(row)} className="btn-secondary mt-5 w-full"><PencilSimple /> Edit partner</button>
      </article>)}
    </div> : <div className="card grid min-h-64 place-items-center p-8 text-center"><div><Buildings className="mx-auto text-slate-300" size={40} /><h2 className="mt-3 font-display font-bold">No partners found</h2><p className="mt-1 text-sm text-slate-500">Create a partner, or book a trip directly with no partner.</p></div></div>}
    {editing && <PartnerEditor partner={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={async (created) => { setEditing(null); setMessage(created ? 'Partner created.' : 'Partner updated.'); await load(); }} />}
  </div>;
}

function PartnerEditor({ partner, onClose, onSaved }: { partner: Partner | null; onClose: () => void; onSaved: (created: boolean) => Promise<void> }) {
  const [draft, setDraft] = useState<PartnerDraft>(() => partner ? {
    name: partner.name, partner_type: partner.partner_type, email: partner.email, phone: partner.phone, address: partner.address,
    representative: partner.representative, billing_email: partner.billing_email, tax_id: partner.tax_id, notes: partner.notes, is_active: partner.is_active,
  } : emptyPartner);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const field = (key: keyof PartnerDraft, value: string | boolean) => setDraft((current) => ({ ...current, [key]: typeof value === 'string' ? value || null : value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...draft, name: draft.name.trim(), partner_type: draft.partner_type || 'corporate' };
      if (partner) await updatePartner(partner.id, payload); else await createPartner(payload);
      await onSaved(!partner);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not save partner.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm"><form onSubmit={submit} className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-gold-dark">Partner directory</p><h2 className="font-display text-2xl font-extrabold">{partner ? 'Edit partner' : 'Add partner'}</h2></div><button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X size={22} /></button></div>
    {error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="mt-6 grid gap-4 md:grid-cols-2"><label className="md:col-span-2"><span className="label">Partner name *</span><input required className="field" value={draft.name || ''} onChange={(e) => field('name', e.target.value)} /></label><label><span className="label">Type</span><select className="field" value={draft.partner_type} onChange={(e) => field('partner_type', e.target.value)}><option value="corporate">Corporate</option><option value="hotel">Hotel</option><option value="travel_agency">Travel agency</option><option value="event">Event</option><option value="normal">Other</option></select></label><label><span className="label">Representative</span><input className="field" value={draft.representative || ''} onChange={(e) => field('representative', e.target.value)} /></label><label><span className="label">Phone</span><input className="field" value={draft.phone || ''} onChange={(e) => field('phone', e.target.value)} /></label><label><span className="label">General email</span><input type="email" className="field" value={draft.email || ''} onChange={(e) => field('email', e.target.value)} /></label><label><span className="label">Billing email</span><input type="email" className="field" value={draft.billing_email || ''} onChange={(e) => field('billing_email', e.target.value)} /></label><label><span className="label">Tax ID</span><input className="field" value={draft.tax_id || ''} onChange={(e) => field('tax_id', e.target.value)} /></label><label className="md:col-span-2"><span className="label">Address</span><textarea className="field min-h-20" value={draft.address || ''} onChange={(e) => field('address', e.target.value)} /></label><label className="md:col-span-2"><span className="label">Notes</span><textarea className="field min-h-24" value={draft.notes || ''} onChange={(e) => field('notes', e.target.value)} /></label><label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={draft.is_active} onChange={(e) => field('is_active', e.target.checked)} className="accent-gold" /> Active and selectable</label></div>
    <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button disabled={saving} className="btn-primary">{saving && <Spinner className="animate-spin" />} Save partner</button></div>
  </form></div>;
}
