import { ArrowRight, BellRinging, Calculator, CheckCircle, ClipboardText, LinkSimple, Spinner, UserCircle, Van, Wallet, WarningCircle, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PlaceField from '../components/PlaceField';
import { createBooking, createPaymentLink, estimateRoute, listDrivers, listPartners, listVehicles, type Driver, type Partner, type Payment, type Place, type Vehicle } from '../services/api';

function defaultSchedule(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

type SubmissionResult = {
  status: 'creating_booking' | 'creating_payment' | 'success' | 'partial' | 'error';
  bookingId?: string;
  payment?: Payment | null;
  message?: string;
};

export default function NewBookingPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule());
  const [guests, setGuests] = useState('1');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [fare, setFare] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [makePayment, setMakePayment] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([listDrivers(), listVehicles(), listPartners()]).then(([d, v, p]) => { if (active) { setDrivers(d.items); setVehicles(v.items); setPartners(p.items); } }).catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Could not load booking options.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedDriver = useMemo(() => drivers.find((row) => row.id === Number(driverId)), [driverId, drivers]);
  const chooseDriver = (value: string) => {
    setDriverId(value);
    const driver = drivers.find((row) => row.id === Number(value));
    if (driver?.vehicle?.id) setVehicleId(String(driver.vehicle.id));
  };
  const estimate = async () => {
    if (!pickup || !dropoff || !vehicleId || !scheduledAt) { setError('Select pickup, drop-off, driver/vehicle and schedule first.'); return; }
    setEstimating(true); setError('');
    try { const result = await estimateRoute({ pickup, dropoff, vehicle_id: Number(vehicleId), scheduled_at: new Date(scheduledAt).toISOString() }); setFare(String(result.fare)); setDistance(String(result.distanceKm)); setDuration(String(result.durationMin)); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not estimate the route.'); }
    finally { setEstimating(false); }
  };
  const reset = () => { setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); setPickup(null); setDropoff(null); setScheduledAt(defaultSchedule()); setGuests('1'); setPartnerId(''); setFare(''); setDistance(''); setDuration(''); setNotes(''); setResult(null); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setResult(null);
    if (!pickup || !dropoff) { setError('Select both pickup and drop-off from the address suggestions.'); return; }
    if (!driverId || !vehicleId) { setError('Every booking must have a driver and vehicle assigned.'); return; }
    const numericFare = Number(fare); const numericDistance = Number(distance); const numericDuration = Number(duration);
    if (!(numericFare > 0) || !(numericDistance >= 0) || !(numericDuration >= 0)) { setError('Estimate the route or enter a valid fare, distance and duration.'); return; }
    setSaving(true);
    setResult({ status: 'creating_booking' });
    try {
      const booking = await createBooking({
        driver_id: Number(driverId), vehicle_id: Number(vehicleId), partner_id: partnerId ? Number(partnerId) : null,
        booking_type: partnerId ? 'partner' : 'normal', customer_name: customerName.trim(), customer_phone: customerPhone.trim(), customer_email: customerEmail.trim() || null,
        pickup, dropoff, scheduled_at: new Date(scheduledAt).toISOString(), guest_count: Number(guests) || 1,
        fare: numericFare, distance_km: numericDistance, duration_min: numericDuration, notes: notes.trim() || null, notify_driver: notify,
      });
      if (makePayment) {
        setResult({ status: 'creating_payment', bookingId: booking.id });
        try {
          const payment = await createPaymentLink(booking.id, numericFare);
          setResult({ status: 'success', bookingId: booking.id, payment });
        } catch (value) {
          setResult({ status: 'partial', bookingId: booking.id, payment: null, message: value instanceof Error ? value.message : 'Please retry from Trips & payments.' });
        }
      } else setResult({ status: 'success', bookingId: booking.id, payment: null });
    } catch (value) { setResult({ status: 'error', message: value instanceof Error ? value.message : 'Could not create the booking.' }); }
    finally { setSaving(false); }
  };
  if (loading) return <div className="grid min-h-[60vh] place-items-center text-sm font-bold text-slate-500"><Spinner className="animate-spin" size={28} /></div>;
  return <div className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.18em] text-gold-dark">Booking desk</p><h1 className="mt-1 font-display text-3xl font-extrabold text-ink">Create a booking</h1><p className="mt-2 text-sm text-slate-500">Customer, journey, assignment and payment—everything essential on one page.</p></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
      <div className="space-y-6">
        <section className="card p-5 lg:p-6"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-gold-soft p-2.5 text-gold-dark"><UserCircle size={22} /></div><div><h2 className="font-display font-bold">Customer</h2><p className="text-xs text-slate-500">Who is travelling?</p></div></div><div className="grid gap-4 md:grid-cols-3"><label><span className="label">Full name *</span><input required className="field" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" /></label><label><span className="label">Phone *</span><input required className="field" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+971…" /></label><label><span className="label">Email</span><input type="email" className="field" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="customer@email.com" /></label></div></section>
        <section className="card p-5 lg:p-6"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Van size={22} /></div><div><h2 className="font-display font-bold">Journey</h2><p className="text-xs text-slate-500">Select verified places; no map interaction required.</p></div></div><div className="grid gap-4 md:grid-cols-2"><PlaceField label="Pickup" value={pickup} onChange={setPickup} /><PlaceField label="Drop-off" value={dropoff} onChange={setDropoff} /><label><span className="label">Pickup date & time *</span><input required type="datetime-local" className="field" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label><label><span className="label">Guests</span><input type="number" min="1" max="99" className="field" value={guests} onChange={(e) => setGuests(e.target.value)} /></label></div></section>
        <section className="card p-5 lg:p-6"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><BellRinging size={22} /></div><div><h2 className="font-display font-bold">Assignment</h2><p className="text-xs text-slate-500">Driver and vehicle are mandatory. Partner is optional.</p></div></div><div className="grid gap-4 md:grid-cols-3"><label><span className="label">Driver *</span><select required className="field" value={driverId} onChange={(e) => chooseDriver(e.target.value)}><option value="">Select driver</option>{drivers.map((row) => <option key={row.id} value={row.id}>{row.first_name} {row.last_name}{row.vehicle ? ` · ${row.vehicle.license_plate}` : ''}</option>)}</select></label><label><span className="label">Vehicle *</span><select required className="field" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}><option value="">Select vehicle</option>{vehicles.map((row) => <option key={row.id} value={row.id}>{row.license_plate} · {row.vehicle_model}</option>)}</select></label><label><span className="label">Partner</span><select className="field" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}><option value="">No partner (direct)</option>{partners.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div>{selectedDriver && !selectedDriver.vehicle && <p className="mt-3 text-xs font-semibold text-amber-700">This driver has no current vehicle assignment. Select the booking vehicle manually.</p>}<label className="mt-4 block"><span className="label">Booking notes</span><textarea className="field min-h-24 resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Flight, room, signboard or special instructions" /></label></section>
      </div>
      <aside className="space-y-6">
        <section className="card p-5 lg:sticky lg:top-24"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Wallet size={22} /></div><div><h2 className="font-display font-bold">Fare & finish</h2><p className="text-xs text-slate-500">Review before creating.</p></div></div><button type="button" disabled={estimating} onClick={() => void estimate()} className="btn-secondary w-full">{estimating ? <Spinner className="animate-spin" /> : <Calculator />} Estimate route & fare</button><div className="mt-4 grid grid-cols-2 gap-3"><label className="col-span-2"><span className="label">Fare (AED) *</span><input type="number" min="0" step="0.01" className="field text-lg font-bold" value={fare} onChange={(e) => setFare(e.target.value)} /></label><label><span className="label">Distance km *</span><input type="number" min="0" step="0.1" className="field" value={distance} onChange={(e) => setDistance(e.target.value)} /></label><label><span className="label">Duration min *</span><input type="number" min="0" className="field" value={duration} onChange={(e) => setDuration(e.target.value)} /></label></div><div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1 accent-gold" /><span><strong className="block text-sm">Notify driver</strong><span className="text-xs text-slate-500">Send assignment notification after creation.</span></span></label><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={makePayment} onChange={(e) => setMakePayment(e.target.checked)} className="mt-1 accent-gold" /><span><strong className="block text-sm">Create payment link</strong><span className="text-xs text-slate-500">Issue invoice and secure CCAvenue link.</span></span></label></div><button disabled={saving} className="btn-gold mt-5 h-12 w-full">{saving ? <><Spinner className="animate-spin" /> Creating…</> : <>Create & assign booking</>}</button><p className="mt-3 text-center text-[11px] leading-4 text-slate-400">Shipping details on CCAvenue are prefilled from the customer and drop-off address.</p></section>
      </aside>
    </form>
    {result && <BookingResultModal result={result} driverName={selectedDriver ? `${selectedDriver.first_name} ${selectedDriver.last_name}`.trim() : ''} vehicle={vehicles.find((row) => row.id === Number(vehicleId)) || null} notify={notify} onClose={() => setResult(null)} onReset={reset} />}
  </div>;
}

function BookingResultModal({ result, driverName, vehicle, notify, onClose, onReset }: { result: SubmissionResult; driverName: string; vehicle: Vehicle | null; notify: boolean; onClose: () => void; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  const running = result.status === 'creating_booking' || result.status === 'creating_payment';
  const successful = result.status === 'success';
  const partial = result.status === 'partial';
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="booking-result-title">
    <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${running ? 'bg-blue-50 text-blue-700' : successful ? 'bg-emerald-50 text-emerald-600' : partial ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
          {running ? <Spinner className="animate-spin" size={30} /> : successful ? <CheckCircle weight="fill" size={32} /> : <WarningCircle weight="fill" size={32} />}
        </div>
        {!running && <button type="button" onClick={onClose} aria-label="Close result" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={22} /></button>}
      </div>

      <h2 id="booking-result-title" className="mt-5 font-display text-2xl font-extrabold text-ink">
        {result.status === 'creating_booking' && 'Creating and assigning booking…'}
        {result.status === 'creating_payment' && `Booking #${result.bookingId} created`}
        {successful && `Booking #${result.bookingId} is ready`}
        {partial && `Booking #${result.bookingId} created with a warning`}
        {result.status === 'error' && 'Booking could not be created'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {result.status === 'creating_booking' && 'Saving the trip, driver and vehicle assignment. Please keep this window open.'}
        {result.status === 'creating_payment' && 'Assignment is saved. Creating the invoice and secure CCAvenue payment link now.'}
        {successful && `Driver and vehicle are assigned${notify ? ', and the driver notification was requested' : ''}.`}
        {partial && `The booking and assignment are safe, but the payment link failed: ${result.message}`}
        {result.status === 'error' && result.message}
      </p>

      {(successful || partial) && <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Booking</span><strong className="mt-1 block">#{result.bookingId}</strong></div>
        <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Status</span><span className={`pill mt-1 ${successful ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{successful ? 'Created' : 'Payment action needed'}</span></div>
        <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Driver</span><strong className="mt-1 block">{driverName || 'Assigned'}</strong></div>
        <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Vehicle</span><strong className="mt-1 block">{vehicle ? `${vehicle.license_plate} · ${vehicle.vehicle_model}` : 'Assigned'}</strong></div>
      </div>}

      {successful && result.payment && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="block text-xs font-bold uppercase tracking-wider text-emerald-700">Payment link & invoice</span><strong className="mt-1 block text-emerald-950">{result.payment.currency} {result.payment.amount.toLocaleString('en-AE')} · {result.payment.status.replaceAll('_', ' ')}</strong><span className="mt-1 block text-xs text-emerald-700">Order {result.payment.orderId}</span></div><CheckCircle weight="fill" className="text-emerald-600" size={28} /></div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => { void navigator.clipboard.writeText(result.payment!.paymentLink); setCopied(true); }} className="btn-secondary flex-1"><ClipboardText /> {copied ? 'Copied' : 'Copy payment link'}</button><a className="btn-gold flex-1" href={result.payment.paymentLink} target="_blank" rel="noreferrer"><LinkSimple /> Open payment page</a></div>
      </div>}

      {!running && <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {(successful || partial) && <Link to="/bookings" className="btn-secondary" onClick={onClose}>View my bookings <ArrowRight /></Link>}
        {(successful || partial) ? <button type="button" onClick={onReset} className="btn-primary">Create another booking</button> : <button type="button" onClick={onClose} className="btn-primary">Return to booking form</button>}
      </div>}
    </div>
  </div>;
}
