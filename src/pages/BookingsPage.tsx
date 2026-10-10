import { ArrowClockwise, BellRinging, CheckCircle, ClipboardText, DownloadSimple, FileArrowUp, LinkSimple, MagnifyingGlass, PencilSimple, Plus, Spinner, X } from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createPaymentLink, downloadInvoice, finance, listBookings, listDrivers, listPartners, listVehicles, notifyDriver, refreshPayment, shareInvoice, updateBooking, type Booking, type Driver, type Partner, type TripFinance, type Vehicle } from '../services/api';

const statusStyle: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700', in_progress: 'bg-violet-50 text-violet-700', completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700', paid: 'bg-emerald-50 text-emerald-700', pending: 'bg-amber-50 text-amber-700',
  link_created: 'bg-sky-50 text-sky-700', failed: 'bg-red-50 text-red-700', aborted: 'bg-orange-50 text-orange-700',
  superseded: 'bg-slate-100 text-slate-500',
};
const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' })
  : 'Not scheduled';

export default function BookingsPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [money, setMoney] = useState<Record<number, TripFinance>>({});
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Booking | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await listBookings({ page, q: appliedQuery, status, createdByMe: true });
      setRows(result.items); setPages(result.total_pages);
      if (result.items.length) {
        const values = await finance(result.items.map((row) => row.id));
        setMoney(Object.fromEntries(values.map((value) => [value.tripId, value])));
      } else setMoney({});
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not load bookings.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [appliedQuery, page, status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true;
    void Promise.all([listDrivers(), listVehicles(), listPartners()]).then(([driverRows, vehicleRows, partnerRows]) => {
      if (active) { setDrivers(driverRows.items); setVehicles(vehicleRows.items); setPartners(partnerRows.items); }
    });
    return () => { active = false; };
  }, []);

  const action = async (key: string, task: () => Promise<void>, reload = true) => {
    setBusyAction(key); setError(''); setMessage('');
    try { await task(); if (reload) await load(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Action failed.'); }
    finally { setBusyAction(null); }
  };
  const makePayment = async (row: Booking) => action(`${row.id}:payment`, async () => {
    const value = await createPaymentLink(row.id, row.fare);
    await navigator.clipboard.writeText(value.paymentLink);
    setMessage('Payment link created and copied. Invoice issued automatically.');
  });
  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); };
  const share = async (row: Booking, entry: TripFinance) => action(`${row.id}:invoice-share`, async () => {
    if (!entry.invoice) return;
    const result = await shareInvoice(entry.invoice.id);
    if (navigator.share) await navigator.share({ title: entry.invoice.invoiceNo, text: 'Z Plus Limousine invoice', url: result.url });
    else await copy(result.url, 'Invoice link');
  }, false);
  const download = async (row: Booking, entry: TripFinance) => action(`${row.id}:invoice-download`, async () => {
    if (!entry.invoice) return;
    await downloadInvoice(entry.invoice.id, entry.invoice.invoiceNo);
    setMessage('Invoice downloaded.');
  }, false);

  const paid = Object.values(money).filter((value) => value.payment?.status === 'paid').length;
  const links = Object.values(money).filter((value) => value.payment).length;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-gold-dark">Operations</p><h1 className="mt-1 font-display text-3xl font-extrabold">My trips & payments</h1><p className="mt-2 text-sm text-slate-500">Bookings created by your account, with assignment, payment and invoice status together.</p></div>
      <Link to="/new" className="btn-gold"><Plus weight="bold" /> New booking</Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Bookings on this page" value={rows.length} /><Summary label="Payment links" value={links} /><Summary label="Paid" value={paid} positive /></div>
    {message && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle />{message}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="card p-4"><form onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedQuery(query.trim()); }} className="flex flex-wrap gap-3"><div className="relative min-w-[240px] flex-1"><MagnifyingGlass className="absolute left-3.5 top-3 text-slate-400" /><input className="field py-2.5 pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, phone, route, driver or partner" /></div><select className="field w-auto min-w-40 py-2.5" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All trip statuses</option><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button disabled={loading} className="btn-primary py-2.5">{loading && <Spinner className="animate-spin" />} Search</button></form></div>
    <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Trip</th><th className="px-4 py-3">Customer & route</th><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={6} className="py-16 text-center"><Spinner className="mx-auto animate-spin text-gold-dark" size={28} /></td></tr> : rows.length ? rows.map((row) => <BookingRow key={row.id} row={row} entry={money[Number(row.id)]} busyAction={busyAction} onAction={action} onPayment={makePayment} onCopy={copy} onShare={share} onDownload={download} onEdit={setEditing} />) : <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-500">You have not created any bookings matching these filters.</td></tr>}</tbody>
    </table></div><div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500"><button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="btn-secondary px-3 py-2">{loading && page > 1 && <Spinner className="animate-spin" />} Previous</button><span>Page {page} of {pages}</span><button disabled={loading || page >= pages} onClick={() => setPage((value) => value + 1)} className="btn-secondary px-3 py-2">Next {loading && page < pages && <Spinner className="animate-spin" />}</button></div></div>
    {editing && <EditBooking booking={editing} drivers={drivers} vehicles={vehicles} partners={partners} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); setMessage('Booking updated.'); await load(); }} />}
  </div>;
}

function Summary({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  return <div className="card px-5 py-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-1 font-display text-2xl font-extrabold ${positive ? 'text-emerald-600' : 'text-ink'}`}>{value}</p></div>;
}

type RowProps = {
  row: Booking; entry?: TripFinance; busyAction: string | null;
  onAction: (key: string, task: () => Promise<void>, reload?: boolean) => Promise<void>;
  onPayment: (row: Booking) => Promise<void>;
  onCopy: (value: string, label: string) => Promise<void>;
  onShare: (row: Booking, entry: TripFinance) => Promise<void>;
  onDownload: (row: Booking, entry: TripFinance) => Promise<void>;
  onEdit: (row: Booking) => void;
};

function BookingRow({ row, entry, busyAction, onAction, onPayment, onCopy, onShare, onDownload, onEdit }: RowProps) {
  const busy = (name: string) => busyAction === `${row.id}:${name}`;
  return <tr className="align-top hover:bg-slate-50/60">
    <td className="whitespace-nowrap px-4 py-4"><strong className="block">#{row.id}</strong><span className={`pill mt-2 ${statusStyle[row.status] || 'bg-slate-100 text-slate-600'}`}>{row.status.replaceAll('_', ' ')}</span><span className="mt-2 block text-xs text-slate-500">{formatDate(row.scheduledAt)}</span></td>
    <td className="max-w-sm px-4 py-4"><strong>{row.customerName}</strong><span className="block text-xs text-slate-500">{row.customerPhone}</span><p className="mt-2 truncate text-xs text-slate-700">{row.pickup.address}</p><p className="truncate text-xs text-slate-400">→ {row.drop.address}</p><p className="mt-2 font-bold">AED {row.fare.toLocaleString('en-AE')}</p></td>
    <td className="px-4 py-4"><strong className="block">{row.driverName || 'Unassigned'}</strong><span className="text-xs text-slate-500">{row.vehiclePlate || 'No vehicle'} · {row.vehicleModel || ''}</span><span className="mt-2 block text-xs text-slate-500">{row.partnerName || 'Direct booking'}</span><button disabled={busy('notify')} onClick={() => void onAction(`${row.id}:notify`, async () => { const result = await notifyDriver(row.id); if (!result.sent) throw new Error(result.reason || 'Notification was not sent.'); })} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 disabled:opacity-50">{busy('notify') ? <Spinner className="animate-spin" /> : <BellRinging />} {busy('notify') ? 'Sending…' : 'Notify driver'}</button></td>
    <td className="px-4 py-4">{entry?.payment ? <><span className={`pill ${statusStyle[entry.payment.status] || 'bg-slate-100 text-slate-600'}`}>{entry.payment.status.replaceAll('_', ' ')}</span><span className="mt-2 block text-xs text-slate-500">{entry.payment.currency} {entry.payment.amount.toLocaleString('en-AE')}</span><div className="mt-2 flex flex-wrap gap-3"><button onClick={() => void onCopy(entry.payment!.paymentLink, 'Payment link')} className="inline-flex items-center gap-1 text-xs font-bold text-gold-dark"><ClipboardText /> Copy</button><button disabled={busy('refresh')} onClick={() => void onAction(`${row.id}:refresh`, async () => { await refreshPayment(entry.payment!.id); })} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 disabled:opacity-50">{busy('refresh') ? <Spinner className="animate-spin" /> : <ArrowClockwise />} {busy('refresh') ? 'Refreshing…' : 'Refresh'}</button></div></> : <><span className="text-xs text-slate-400">No payment link</span><button disabled={busy('payment')} onClick={() => void onPayment(row)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-gold-dark disabled:opacity-50">{busy('payment') ? <Spinner className="animate-spin" /> : <LinkSimple />} {busy('payment') ? 'Creating…' : 'Create link'}</button></>}</td>
    <td className="px-4 py-4">{entry?.invoice ? <><strong className="block text-xs">{entry.invoice.invoiceNo}</strong><span className={`pill mt-2 ${statusStyle[entry.invoice.status] || 'bg-slate-100 text-slate-600'}`}>{entry.invoice.status}</span><div className="mt-2 flex gap-3"><button disabled={busy('invoice-download')} onClick={() => void onDownload(row, entry)} title="Download invoice" className="text-slate-600 hover:text-navy disabled:opacity-50">{busy('invoice-download') ? <Spinner className="animate-spin" size={18} /> : <DownloadSimple size={18} />}</button><button disabled={busy('invoice-share')} onClick={() => void onShare(row, entry)} title="Share invoice" className="text-slate-600 hover:text-navy disabled:opacity-50">{busy('invoice-share') ? <Spinner className="animate-spin" size={18} /> : <FileArrowUp size={18} />}</button></div></> : <span className="text-xs text-slate-400">Created with payment link</span>}</td>
    <td className="px-4 py-4 text-right"><button onClick={() => onEdit(row)} className="btn-secondary px-3 py-2"><PencilSimple /> Edit</button>{entry?.payment && !['paid', 'pending'].includes(entry.payment.status) && <button disabled={busy('payment')} onClick={() => void onPayment(row)} className="mt-2 inline-flex w-full items-center justify-center gap-1 text-xs font-bold text-gold-dark disabled:opacity-50">{busy('payment') && <Spinner className="animate-spin" />} {busy('payment') ? 'Creating…' : 'New payment link'}</button>}</td>
  </tr>;
}

function EditBooking({ booking, drivers, vehicles, partners, onClose, onSaved }: { booking: Booking; drivers: Driver[]; vehicles: Vehicle[]; partners: Partner[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const matchingVehicle = vehicles.find((row) => row.license_plate === booking.vehiclePlate);
  const [driverId, setDriverId] = useState(String(booking.driverId));
  const [vehicleId, setVehicleId] = useState(matchingVehicle ? String(matchingVehicle.id) : '');
  const [partnerId, setPartnerId] = useState(booking.partnerId ? String(booking.partnerId) : '');
  const [status, setStatus] = useState(booking.status);
  const [name, setName] = useState(booking.customerName);
  const [phone, setPhone] = useState(booking.customerPhone);
  const [email, setEmail] = useState(booking.customerEmail || '');
  const [schedule, setSchedule] = useState(booking.scheduledAt ? new Date(booking.scheduledAt).toISOString().slice(0, 16) : '');
  const [fare, setFare] = useState(String(booking.fare));
  const [notes, setNotes] = useState(booking.bookingNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await updateBooking(booking.id, { driver_id: Number(driverId), vehicle_id: Number(vehicleId), partner_id: partnerId ? Number(partnerId) : null, status, customer_name: name.trim(), customer_phone: phone.trim(), customer_email: email.trim(), scheduled_at: new Date(schedule).toISOString(), fare: Number(fare), notes: notes.trim() });
      await onSaved();
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not update booking.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm"><form onSubmit={submit} className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-gold-dark">Booking #{booking.id}</p><h2 className="font-display text-2xl font-extrabold">Modify booking</h2></div><button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X size={22} /></button></div>{error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}<div className="mt-6 grid gap-4 md:grid-cols-2"><label><span className="label">Customer name</span><input required className="field" value={name} onChange={(event) => setName(event.target.value)} /></label><label><span className="label">Phone</span><input required className="field" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="md:col-span-2"><span className="label">Email</span><input type="email" className="field" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span className="label">Driver *</span><select required className="field" value={driverId} onChange={(event) => setDriverId(event.target.value)}>{drivers.map((row) => <option key={row.id} value={row.id}>{row.first_name} {row.last_name}</option>)}</select></label><label><span className="label">Vehicle *</span><select required className="field" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Select vehicle</option>{vehicles.map((row) => <option key={row.id} value={row.id}>{row.license_plate} · {row.vehicle_model}</option>)}</select></label><label><span className="label">Partner</span><select className="field" value={partnerId} onChange={(event) => setPartnerId(event.target.value)}><option value="">No partner</option>{partners.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label><span className="label">Status</span><select className="field" value={status} onChange={(event) => setStatus(event.target.value as Booking['status'])}><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label><span className="label">Pickup time</span><input required type="datetime-local" className="field" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></label><label><span className="label">Fare (AED)</span><input required type="number" min="0" step="0.01" className="field" value={fare} onChange={(event) => setFare(event.target.value)} /></label><label className="md:col-span-2"><span className="label">Notes</span><textarea className="field min-h-28" value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button disabled={saving} className="btn-primary">{saving && <Spinner className="animate-spin" />} Save changes</button></div></form></div>;
}
