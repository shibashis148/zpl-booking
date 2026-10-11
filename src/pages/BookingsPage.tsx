import { ArrowClockwise, BellRinging, CheckCircle, ClipboardText, ClockCountdown, DownloadSimple, FileArrowUp, LinkSimple, ListBullets, MagnifyingGlass, PencilSimple, Play, Plus, Spinner, Stop, X } from '@phosphor-icons/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BookingBoard, BookingCalendar, BookingStatusOverview, BookingViewTabs, type BookingView } from '../components/bookings/BookingViews';
import { addInvoiceAdjustment, createPaymentLink, downloadInvoice, extendRental, finance, listBookings, listDrivers, listPartners, listVehicles, notifyDriver, refreshPayment, shareInvoice, updateBooking, type AdjustmentCategory, type Booking, type Driver, type Partner, type TripFinance, type Vehicle } from '../services/api';

const statusStyle: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700', in_progress: 'bg-violet-50 text-violet-700', completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700', paid: 'bg-emerald-50 text-emerald-700', pending: 'bg-amber-50 text-amber-700',
  link_created: 'bg-sky-50 text-sky-700', failed: 'bg-red-50 text-red-700', aborted: 'bg-orange-50 text-orange-700',
  superseded: 'bg-slate-100 text-slate-500',
  partially_paid: 'bg-amber-50 text-amber-700', issued: 'bg-blue-50 text-blue-700',
};
const formatDate = (value?: string | number | null) => value
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
  const [view, setView] = useState<BookingView>('list');
  const [editing, setEditing] = useState<Booking | null>(null);
  const [extending, setExtending] = useState<Booking | null>(null);
  const [adjusting, setAdjusting] = useState<Booking | null>(null);
  const [history, setHistory] = useState<Booking | null>(null);
  const [pendingMove, setPendingMove] = useState<{ row: Booking; status: Booking['status'] } | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const result = await listBookings({ page, pageSize: 100, q: appliedQuery, status, createdByMe: true });
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
    const outstanding = money[Number(row.id)]?.totals.outstanding;
    const value = await createPaymentLink(row.id, outstanding && outstanding > 0 ? outstanding : undefined);
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
  const confirmMove = async () => {
    if (!pendingMove) return;
    const { row, status: nextStatus } = pendingMove;
    setPendingMove(null);
    await action(`${row.id}:move`, async () => {
      await updateBooking(row.id, { status: nextStatus });
      setMessage(`Booking #${row.id} moved to ${nextStatus.replaceAll('_', ' ')}.`);
    });
  };

  const paid = Object.values(money).filter((value) => value.totals.charged > 0 && value.totals.outstanding <= 0).length;
  const links = Object.values(money).filter((value) => value.payment).length;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-gold-dark">Operations</p><h1 className="mt-1 font-display text-3xl font-extrabold">My trips & payments</h1><p className="mt-2 text-sm text-slate-500">Bookings created by your account, with assignment, payment and invoice status together.</p></div>
      <div className="flex flex-wrap items-center gap-3"><BookingViewTabs value={view} onChange={setView} /><Link to="/new" className="btn-gold"><Plus weight="bold" /> New booking</Link></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3"><Summary label="Bookings on this page" value={rows.length} /><Summary label="Payment links" value={links} /><Summary label="Paid" value={paid} positive /></div>
    {message && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle />{message}</div>}
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <div className="card p-4"><form onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedQuery(query.trim()); }} className="flex flex-wrap gap-3"><div className="relative min-w-[240px] flex-1"><MagnifyingGlass className="absolute left-3.5 top-3 text-slate-400" /><input className="field py-2.5 pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, phone, route, driver or partner" /></div><select className="field w-auto min-w-40 py-2.5" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All trip statuses</option><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button disabled={loading} className="btn-primary py-2.5">{loading && <Spinner className="animate-spin" />} Search</button></form></div>
    {loading && view !== 'list' ? <div className="card grid min-h-96 place-items-center"><div className="text-center"><Spinner className="mx-auto animate-spin text-gold-dark" size={30} /><p className="mt-3 text-sm font-semibold text-slate-500">Loading operations view…</p></div></div> : view === 'list' ? <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Trip</th><th className="px-4 py-3">Customer & route</th><th className="px-4 py-3">Assignment</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={6} className="py-16 text-center"><Spinner className="mx-auto animate-spin text-gold-dark" size={28} /></td></tr> : rows.length ? rows.map((row) => <BookingRow key={row.id} row={row} entry={money[Number(row.id)]} busyAction={busyAction} onAction={action} onPayment={makePayment} onCopy={copy} onShare={share} onDownload={download} onEdit={setEditing} onExtend={setExtending} onAdjust={setAdjusting} onHistory={setHistory} />) : <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-500">You have not created any bookings matching these filters.</td></tr>}</tbody>
    </table></div></div> : view === 'board' ? <div className="overflow-x-auto pb-2"><BookingBoard rows={rows} money={money} busyAction={busyAction} onView={setHistory} onMove={(row, nextStatus) => { if (nextStatus === 'cancelled') { setMessage('Choose cancelled or no-show treatment, then save the booking.'); setEditing(row); } else setPendingMove({ row, status: nextStatus }); }} /></div> : view === 'calendar' ? <div className="overflow-x-auto"><BookingCalendar rows={rows} onView={setHistory} /></div> : <BookingStatusOverview rows={rows} money={money} onView={setHistory} />}
    {pages > 1 && <div className="card flex items-center justify-between px-4 py-3 text-sm text-slate-500"><button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="btn-secondary px-3 py-2">{loading && page > 1 && <Spinner className="animate-spin" />} Previous</button><span>Page {page} of {pages}</span><button disabled={loading || page >= pages} onClick={() => setPage((value) => value + 1)} className="btn-secondary px-3 py-2">Next {loading && page < pages && <Spinner className="animate-spin" />}</button></div>}
    {editing && <EditBooking booking={editing} drivers={drivers} vehicles={vehicles} partners={partners} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); setMessage('Booking updated.'); await load(); }} />}
    {extending && <ExtendRental booking={extending} onClose={() => setExtending(null)} onSaved={async (paymentLink) => { setExtending(null); if (paymentLink) await navigator.clipboard.writeText(paymentLink); setMessage(paymentLink ? 'Rental extended. Extra payment link copied.' : 'Rental extended and invoice updated.'); await load(); }} />}
    {history && money[Number(history.id)] && <><BookingHistory booking={history} entry={money[Number(history.id)]} onClose={() => setHistory(null)} onCopy={copy} onShare={share} onDownload={download} busyAction={busyAction} /><div className="fixed bottom-5 right-5 z-[55] flex gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur"><button type="button" onClick={() => { setEditing(history); setHistory(null); }} className="btn-secondary px-3"><PencilSimple /> Edit booking</button><button type="button" onClick={() => setAdjusting(history)} className="btn-gold px-3"><Plus /> Adjust invoice</button></div></>}
    {adjusting && <InvoiceAdjustment booking={adjusting} onClose={() => setAdjusting(null)} onSaved={async (paymentLink) => { setAdjusting(null); if (paymentLink) await navigator.clipboard.writeText(paymentLink); setMessage(paymentLink ? 'Invoice item added. New payment link copied.' : 'Invoice item added and totals refreshed.'); await load(); }} />}
    {pendingMove && <ConfirmStatusMove row={pendingMove.row} status={pendingMove.status} onClose={() => setPendingMove(null)} onConfirm={() => void confirmMove()} />}
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
  onExtend: (row: Booking) => void;
  onAdjust: (row: Booking) => void;
  onHistory: (row: Booking) => void;
};

function BookingRow({ row, entry, busyAction, onAction, onPayment, onCopy, onShare, onDownload, onEdit, onExtend, onAdjust, onHistory }: RowProps) {
  const busy = (name: string) => busyAction === `${row.id}:${name}`;
  const isRental = row.bookingType === 'rental';
  const outstanding = entry?.totals.outstanding || 0;
  return <tr className="align-top hover:bg-slate-50/60">
    <td className="whitespace-nowrap px-4 py-4"><div className="flex items-center gap-2"><strong>#{row.id}</strong>{isRental && <span className="pill bg-violet-50 text-violet-700"><ClockCountdown /> Rental</span>}</div><span className={`pill mt-2 ${statusStyle[row.status] || 'bg-slate-100 text-slate-600'}`}>{row.financialDisposition === 'no_show_chargeable' ? 'no show' : row.financialDisposition === 'cancelled_non_chargeable' ? 'cancelled · no charge' : row.status.replaceAll('_', ' ')}</span><span className="mt-1 block text-xs font-semibold text-slate-600">{row.serviceType.replaceAll('_', ' ')}</span><span className="mt-2 block text-xs text-slate-500">Start · {formatDate(row.scheduledAt)}</span>{isRental && <><span className="mt-1 block text-xs font-semibold text-violet-700">{row.rentalDurationHours} hours</span><span className="block text-xs text-slate-500">End · {formatDate(row.rentalEndAt)}</span></>}</td>
    <td className="max-w-sm px-4 py-4"><strong>{row.customerName}</strong><span className="block text-xs text-slate-500">{row.customerPhone || 'No phone provided'}</span><p className="mt-2 truncate text-xs text-slate-700">{row.pickup.address}</p><p className="truncate text-xs text-slate-400">→ {row.drop.address}</p><p className="mt-2 font-bold">AED {row.fare.toLocaleString('en-AE')}</p></td>
    <td className="px-4 py-4"><strong className="block">{row.driverName || 'Unassigned'}</strong><span className="text-xs text-slate-500">{row.vehiclePlate || 'No vehicle'} · {row.vehicleModel || row.vehicleClass?.replaceAll('_', ' ') || ''}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{row.assignmentStatus.replaceAll('_', ' ')}</span><span className="mt-2 block text-xs text-slate-500">{row.partnerName || 'Direct booking'}</span>{row.assignmentStatus !== 'unassigned' && <button disabled={busy('notify')} onClick={() => void onAction(`${row.id}:notify`, async () => { const result = await notifyDriver(row.id); if (!result.sent) throw new Error(result.reason || 'Notification was not sent.'); })} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 disabled:opacity-50">{busy('notify') ? <Spinner className="animate-spin" /> : <BellRinging />} {busy('notify') ? 'Sending…' : 'Notify driver'}</button>}</td>
    <td className="px-4 py-4">{entry ? <><div className="flex items-center gap-2"><span className={`pill ${entry.totals.outstanding <= 0 && entry.totals.charged > 0 ? statusStyle.paid : entry.payment ? statusStyle[entry.payment.status] || statusStyle.pending : 'bg-slate-100 text-slate-600'}`}>{entry.totals.outstanding <= 0 && entry.totals.charged > 0 ? 'paid' : entry.payment?.status.replaceAll('_', ' ') || 'not sent'}</span></div><span className="mt-2 block text-xs text-slate-500">Paid AED {entry.totals.paid.toLocaleString('en-AE')}</span><strong className={`block text-xs ${outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>Due AED {outstanding.toLocaleString('en-AE')}</strong>{entry.payment && <div className="mt-2 flex flex-wrap gap-3"><button onClick={() => void onCopy(entry.payment!.paymentLink, 'Payment link')} className="inline-flex items-center gap-1 text-xs font-bold text-gold-dark"><ClipboardText /> Copy</button><button disabled={busy('refresh')} onClick={() => void onAction(`${row.id}:refresh`, async () => { await refreshPayment(entry.payment!.id); })} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 disabled:opacity-50">{busy('refresh') ? <Spinner className="animate-spin" /> : <ArrowClockwise />} {busy('refresh') ? 'Refreshing…' : 'Refresh'}</button></div>}{outstanding > 0 && !entry.payment && <button disabled={busy('payment')} onClick={() => void onPayment(row)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-gold-dark disabled:opacity-50">{busy('payment') ? <Spinner className="animate-spin" /> : <LinkSimple />} {busy('payment') ? 'Creating…' : 'Create link'}</button>}</> : <span className="text-xs text-slate-400">Loading money…</span>}</td>
    <td className="px-4 py-4">{entry?.invoice ? <><strong className="block text-xs">{entry.invoice.invoiceNo}</strong><span className={`pill mt-2 ${statusStyle[entry.invoice.status] || 'bg-slate-100 text-slate-600'}`}>{entry.invoice.status.replaceAll('_', ' ')}</span><span className="mt-2 block text-xs text-slate-500">AED {entry.invoice.amount.toLocaleString('en-AE')}</span><div className="mt-2 flex gap-3"><button disabled={busy('invoice-download')} onClick={() => void onDownload(row, entry)} title="Download invoice" className="text-slate-600 hover:text-navy disabled:opacity-50">{busy('invoice-download') ? <Spinner className="animate-spin" size={18} /> : <DownloadSimple size={18} />}</button><button disabled={busy('invoice-share')} onClick={() => void onShare(row, entry)} title="Share invoice" className="text-slate-600 hover:text-navy disabled:opacity-50">{busy('invoice-share') ? <Spinner className="animate-spin" size={18} /> : <FileArrowUp size={18} />}</button></div></> : <span className="text-xs text-slate-400">Not issued yet</span>}</td>
    <td className="min-w-40 px-4 py-4 text-right"><div className="flex flex-col gap-2"><button onClick={() => onHistory(row)} className="btn-secondary px-3 py-2"><ListBullets /> View details</button>{row.status === 'scheduled' && <button disabled={busy('start')} onClick={() => void onAction(`${row.id}:start`, async () => { await updateBooking(row.id, { status: 'in_progress' }); })} className="btn-primary px-3 py-2">{busy('start') ? <Spinner className="animate-spin" /> : <Play />} Start {isRental ? 'rental' : 'trip'}</button>}{row.status === 'in_progress' && <button disabled={busy('complete')} onClick={() => void onAction(`${row.id}:complete`, async () => { await updateBooking(row.id, { status: 'completed' }); })} className="btn-primary px-3 py-2">{busy('complete') ? <Spinner className="animate-spin" /> : <Stop />} Complete</button>}{isRental && !['completed', 'cancelled'].includes(row.status) && <button onClick={() => onExtend(row)} className="btn-gold px-3 py-2"><ClockCountdown /> Extend rental</button>}<button onClick={() => onAdjust(row)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-gold-dark hover:text-navy"><Plus /> Adjust invoice</button><button onClick={() => onEdit(row)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-slate-500 hover:text-navy"><PencilSimple /> Edit details</button>{outstanding > 0 && entry?.payment && !['pending', 'link_created'].includes(entry.payment.status) && <button disabled={busy('payment')} onClick={() => void onPayment(row)} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-gold-dark disabled:opacity-50">{busy('payment') && <Spinner className="animate-spin" />} {busy('payment') ? 'Creating…' : 'New payment link'}</button>}</div></td>
  </tr>;
}

function EditBooking({ booking, drivers, vehicles, partners, onClose, onSaved }: { booking: Booking; drivers: Driver[]; vehicles: Vehicle[]; partners: Partner[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const matchingVehicle = vehicles.find((row) => row.license_plate === booking.vehiclePlate);
  const [assignmentMode, setAssignmentMode] = useState<'unassigned' | 'assigned'>(booking.assignmentStatus === 'unassigned' ? 'unassigned' : 'assigned');
  const [driverId, setDriverId] = useState(booking.driverId ? String(booking.driverId) : '');
  const [vehicleId, setVehicleId] = useState(matchingVehicle ? String(matchingVehicle.id) : '');
  const [partnerId, setPartnerId] = useState(booking.partnerId ? String(booking.partnerId) : '');
  const [status, setStatus] = useState(booking.status);
  const [disposition, setDisposition] = useState<'active' | 'cancelled_non_chargeable' | 'no_show_chargeable'>(booking.financialDisposition === 'standard' ? 'active' : booking.financialDisposition);
  const [name, setName] = useState(booking.customerName);
  const [phone, setPhone] = useState(booking.customerPhone);
  const [email, setEmail] = useState(booking.customerEmail || '');
  const [schedule, setSchedule] = useState(booking.scheduledAt ? dubaiInputValue(new Date(booking.scheduledAt)) : '');
  const [fare, setFare] = useState(String(booking.fare));
  const [notes, setNotes] = useState(booking.bookingNotes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (assignmentMode === 'assigned' && (!driverId || !vehicleId)) throw new Error('Select both driver and vehicle, or keep this booking unassigned.');
      await updateBooking(booking.id, { driver_id: assignmentMode === 'assigned' ? Number(driverId) : null, vehicle_id: assignmentMode === 'assigned' ? Number(vehicleId) : null, partner_id: partnerId ? Number(partnerId) : null, status, disposition, customer_name: name.trim(), customer_phone: phone.trim(), customer_email: email.trim(), scheduled_at: `${schedule}:00+04:00`, fare: Number(fare), notes: notes.trim() });
      await onSaved();
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not update booking.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm"><form onSubmit={submit} className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-gold-dark">Booking #{booking.id}</p><h2 className="font-display text-2xl font-extrabold">Modify booking</h2></div><button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X size={22} /></button></div>{error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}<div className="mt-6 grid gap-4 md:grid-cols-2"><label><span className="label">Customer name</span><input required className="field" value={name} onChange={(event) => setName(event.target.value)} /></label><label><span className="label">Phone (optional)</span><input type="tel" className="field" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="md:col-span-2"><span className="label">Email</span><input type="email" className="field" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label><span className="label">Assignment</span><select className="field" value={assignmentMode} onChange={(event) => { const mode = event.target.value as 'unassigned' | 'assigned'; setAssignmentMode(mode); if (mode === 'unassigned') { setDriverId(''); setVehicleId(''); } }}><option value="unassigned">Unassigned</option><option value="assigned">Assigned</option></select></label><label><span className="label">Account</span><select className="field" value={partnerId} onChange={(event) => setPartnerId(event.target.value)}><option value="">Direct / no account</option>{partners.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>{assignmentMode === 'assigned' && <><label><span className="label">Driver *</span><select required className="field" value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">Select driver</option>{drivers.map((row) => <option key={row.id} value={row.id}>{row.first_name} {row.last_name}</option>)}</select></label><label><span className="label">Vehicle *</span><select required className="field" value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Select vehicle</option>{vehicles.map((row) => <option key={row.id} value={row.id}>{row.license_plate} · {row.vehicle_model}</option>)}</select></label></>}<label><span className="label">Trip status</span><select className="field" value={status} onChange={(event) => setStatus(event.target.value as Booking['status'])}><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><label><span className="label">Cancellation / finance</span><select className="field" value={disposition} onChange={(event) => setDisposition(event.target.value as typeof disposition)}><option value="active">Active / standard</option><option value="cancelled_non_chargeable">Cancelled — non chargeable</option><option value="no_show_chargeable">No show — chargeable</option></select></label><label><span className="label">Pickup time</span><input required type="datetime-local" className="field" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></label><label><span className="label">Fare (AED)</span><input required type="number" min="0" step="0.01" className="field" value={fare} onChange={(event) => setFare(event.target.value)} /></label><label className="md:col-span-2"><span className="label">Notes</span><textarea className="field min-h-28" value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button disabled={saving} className="btn-primary">{saving && <Spinner className="animate-spin" />} Save changes</button></div></form></div>;
}

function ExtendRental({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: (paymentLink?: string) => Promise<void> }) {
  const [hours, setHours] = useState('0.5');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [createLink, setCreateLink] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const currentEnd = booking.rentalEndAt ? new Date(booking.rentalEndAt) : new Date();
  const newEnd = new Date(currentEnd.getTime() + Number(hours) * 60 * 60 * 1000);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      if (!(Number(amount) > 0)) throw new Error('Enter the agreed extension price.');
      const result = await extendRental(booking.id, { additionalHours: Number(hours), amount: Number(amount), notes: notes.trim() || undefined, createPaymentLink: createLink });
      await onSaved(result.payment?.paymentLink);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not extend this rental.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><span className="pill bg-violet-50 text-violet-700"><ClockCountdown /> Rental #{booking.id}</span><h2 className="mt-3 font-display text-2xl font-extrabold">Extend rental</h2><p className="mt-1 text-sm text-slate-500">Adds a new invoice line and preserves the original charge.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X size={22} /></button></div>{error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}<div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="label">Extra time *</span><select className="field" value={hours} onChange={(event) => setHours(event.target.value)}>{Array.from({ length: 48 }, (_, index) => .5 + index * .5).map((value) => <option key={value} value={value}>{value} {value === 1 ? 'hour' : 'hours'}</option>)}</select></label><label><span className="label">Extension price (AED) *</span><input required autoFocus type="number" min="0.01" step="0.01" className="field" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><div className="sm:col-span-2 rounded-2xl border border-violet-100 bg-violet-50 p-4"><div className="grid gap-3 sm:grid-cols-2"><div><span className="text-xs font-bold uppercase tracking-wider text-violet-600">Current end</span><strong className="mt-1 block text-sm">{formatDate(booking.rentalEndAt)}</strong></div><div><span className="text-xs font-bold uppercase tracking-wider text-violet-600">New planned end</span><strong className="mt-1 block text-sm">{formatDate(newEnd.toISOString())}</strong></div></div></div><label className="sm:col-span-2"><span className="label">Reason or note</span><textarea className="field min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Customer requested additional waiting time…" /></label><label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4"><input type="checkbox" checked={createLink} onChange={(event) => setCreateLink(event.target.checked)} className="mt-1 accent-gold" /><span><strong className="block text-sm">Create extra payment link</strong><span className="text-xs text-slate-500">Creates a link for only this extension amount and refreshes the invoice total.</span></span></label></div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button disabled={saving} className="btn-gold">{saving ? <><Spinner className="animate-spin" /> Extending…</> : <><ClockCountdown /> Confirm extension</>}</button></div></form></div>;
}

const adjustmentOptions: Array<{ value: AdjustmentCategory; label: string; hint: string }> = [
  { value: 'salik', label: 'Salik toll', hint: 'Road toll charged during service' },
  { value: 'parking', label: 'Parking', hint: 'Hotel, airport or venue parking' },
  { value: 'airport_fee', label: 'Airport fee', hint: 'Airport pickup or access charge' },
  { value: 'waiting_time', label: 'Waiting time', hint: 'Chargeable waiting after allowance' },
  { value: 'extra_stop', label: 'Extra stop', hint: 'Stop added after confirmation' },
  { value: 'gratuity', label: 'Gratuity', hint: 'Customer-approved gratuity' },
  { value: 'damage_cleaning', label: 'Damage / cleaning', hint: 'Documented recovery charge' },
  { value: 'discount', label: 'Discount / credit', hint: 'Reduces the amount due' },
  { value: 'other', label: 'Other adjustment', hint: 'Any other agreed invoice line' },
];

function InvoiceAdjustment({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: (paymentLink?: string) => Promise<void> }) {
  const [category, setCategory] = useState<AdjustmentCategory>('salik');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [createLink, setCreateLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = adjustmentOptions.find((option) => option.value === category)!;
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      if (!(Number(amount) > 0)) throw new Error('Enter a valid adjustment amount.');
      if (reason.trim().length < 3) throw new Error('Add a short reason for the audit record.');
      const result = await addInvoiceAdjustment(booking.id, { category, amount: Number(amount), reason: reason.trim(), createPaymentLink: category !== 'discount' && createLink });
      await onSaved(result.payment?.paymentLink);
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not adjust this invoice.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><span className="pill bg-gold-soft text-gold-dark">Invoice · booking #{booking.id}</span><h2 className="mt-3 font-display text-2xl font-extrabold">Add invoice item</h2><p className="mt-1 text-sm text-slate-500">Creates a permanent ledger entry. Existing lines stay unchanged.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X size={22} /></button></div>{error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}<div className="mt-6 space-y-4"><label><span className="label">Fee or adjustment *</span><select className="field" value={category} onChange={(event) => { const value = event.target.value as AdjustmentCategory; setCategory(value); if (value === 'discount') setCreateLink(false); }}>{adjustmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-1.5 block text-xs text-slate-500">{selected.hint}</span></label><label><span className="label">Amount (AED) *</span><input required autoFocus type="number" min="0.01" step="0.01" className="field text-lg font-bold" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label><span className="label">Reason *</span><textarea required minLength={3} maxLength={500} className="field min-h-24" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Example: Two Salik gates used on the guest-requested route" /></label>{category === 'discount' ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><strong>Credit entry</strong><span className="mt-1 block text-xs">This amount reduces the invoice. It cannot reduce charges below payments already received.</span></div> : <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4"><input type="checkbox" checked={createLink} onChange={(event) => setCreateLink(event.target.checked)} className="mt-1 accent-gold" /><span><strong className="block text-sm">Create payment link for this amount</strong><span className="mt-1 block text-xs text-slate-500">The invoice total is updated either way.</span></span></label>}</div><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button disabled={saving} className="btn-gold">{saving ? <><Spinner className="animate-spin" /> Saving…</> : <>Add {category === 'discount' ? 'credit' : 'charge'}</>}</button></div></form></div>;
}

function ConfirmStatusMove({ row, status, onClose, onConfirm }: { row: Booking; status: Booking['status']; onClose: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><span className="pill bg-blue-50 text-blue-700">Dispatch update</span><h2 className="mt-4 font-display text-xl font-extrabold">Move booking #{row.id}?</h2><p className="mt-2 text-sm leading-6 text-slate-600"><strong>{row.customerName}</strong> will move from <strong>{row.status.replaceAll('_', ' ')}</strong> to <strong>{status.replaceAll('_', ' ')}</strong>. This updates the same trip record and is visible across the portal.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">Keep current</button><button type="button" onClick={onConfirm} className="btn-primary">Confirm move</button></div></div></div>;
}

function BookingHistory({ booking, entry, onClose, onCopy, onShare, onDownload, busyAction }: { booking: Booking; entry: TripFinance; onClose: () => void; onCopy: (value: string, label: string) => Promise<void>; onShare: (row: Booking, entry: TripFinance) => Promise<void>; onDownload: (row: Booking, entry: TripFinance) => Promise<void>; busyAction: string | null }) {
  const busy = (name: string) => busyAction === `${booking.id}:${name}`;
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-sm"><div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 p-6 backdrop-blur"><div><p className="text-xs font-bold uppercase tracking-wider text-gold-dark">Booking #{booking.id}</p><h2 className="font-display text-2xl font-extrabold">Activity & money</h2><p className="mt-1 text-sm text-slate-500">Read-only history of operational and financial events.</p></div><button onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X size={22} /></button></div><div className="space-y-6 p-6"><div className="grid grid-cols-3 gap-3"><MoneyCard label="Charged" value={entry.totals.charged} /><MoneyCard label="Paid" value={entry.totals.paid} positive /><MoneyCard label="Due" value={entry.totals.outstanding} warning={entry.totals.outstanding > 0} /></div>{entry.invoice && <section className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live invoice</span><strong className="mt-1 block">{entry.invoice.invoiceNo}</strong><span className={`pill mt-2 ${statusStyle[entry.invoice.status] || 'bg-slate-100 text-slate-600'}`}>{entry.invoice.status.replaceAll('_', ' ')}</span></div><div className="flex gap-2"><button disabled={busy('invoice-download')} onClick={() => void onDownload(booking, entry)} className="btn-secondary px-3">{busy('invoice-download') ? <Spinner className="animate-spin" /> : <DownloadSimple />} PDF</button><button disabled={busy('invoice-share')} onClick={() => void onShare(booking, entry)} className="btn-secondary px-3">{busy('invoice-share') ? <Spinner className="animate-spin" /> : <FileArrowUp />} Share</button></div></div></section>}<section><div className="mb-4 flex items-center justify-between"><div><h3 className="font-display text-lg font-bold">Timeline</h3><p className="text-xs text-slate-500">Events cannot be edited or deleted.</p></div><span className="pill bg-slate-100 text-slate-600">{entry.transactions.length} events</span></div><div className="space-y-0">{entry.transactions.length ? entry.transactions.map((transaction, index) => <div key={transaction.id} className="relative flex gap-4 pb-6"><div className="relative z-[1] mt-1 h-3 w-3 shrink-0 rounded-full bg-navy ring-4 ring-slate-100" />{index < entry.transactions.length - 1 && <span className="absolute bottom-0 left-[5px] top-4 w-px bg-slate-200" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="block text-sm">{transaction.description}</strong><span className="mt-1 block text-xs text-slate-500">{eventLabel(transaction.eventType)} · {formatDate(transaction.createdAt)}</span></div>{transaction.amount !== 0 && <strong className={transaction.amount < 0 ? 'text-red-600' : 'text-ink'}>{transaction.amount < 0 ? '−' : '+'} AED {Math.abs(transaction.amount).toLocaleString('en-AE')}</strong>}</div>{typeof transaction.metadata.notes === 'string' && transaction.metadata.notes && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{transaction.metadata.notes}</p>}</div></div>) : <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No activity recorded yet.</div>}</div></section>{entry.payments.length > 0 && <section><h3 className="font-display text-lg font-bold">Payment links</h3><div className="mt-3 space-y-3">{entry.payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><div className="flex items-center gap-2"><strong className="text-sm">{payment.orderId}</strong><span className={`pill ${statusStyle[payment.status] || 'bg-slate-100 text-slate-600'}`}>{payment.status.replaceAll('_', ' ')}</span></div><span className="mt-1 block text-xs text-slate-500">AED {payment.amount.toLocaleString('en-AE')} · {formatDate(payment.linkCreatedAt)}</span></div><button onClick={() => void onCopy(payment.paymentLink, 'Payment link')} className="btn-secondary px-3 py-2"><ClipboardText /> Copy</button></div>)}</div></section>}</div></div></div>;
}

function MoneyCard({ label, value, positive = false, warning = false }: { label: string; value: number; positive?: boolean; warning?: boolean }) {
  return <div className={`rounded-2xl p-4 ${positive ? 'bg-emerald-50' : warning ? 'bg-amber-50' : 'bg-slate-50'}`}><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span><strong className={`mt-1 block text-lg ${positive ? 'text-emerald-700' : warning ? 'text-amber-700' : 'text-ink'}`}>AED {value.toLocaleString('en-AE')}</strong></div>;
}

function eventLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dubaiInputValue(value: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
