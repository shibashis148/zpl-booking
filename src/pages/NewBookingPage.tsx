import { ArrowRight, BellRinging, Calculator, CheckCircle, ClipboardText, LinkSimple, MapPin, Spinner, UserCircle, Wallet, WarningCircle, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PlaceField from '../components/PlaceField';
import { createBooking, createPaymentLink, estimateRoute, listDrivers, listPartners, listVehicles, type ChildSeat, type ChildSeatType, type Driver, type Partner, type Payment, type Place, type ServiceType, type Vehicle, type VehicleClass } from '../services/api';

function defaultSchedule(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  return dubaiInputValue(date);
}

function dubaiInputValue(value: Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function dubaiIso(value: string): string { return `${value}:00+04:00`; }

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
  const [stops, setStops] = useState<Array<Place | null>>([]);
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule());
  const [guests, setGuests] = useState('1');
  const [luggage, setLuggage] = useState('0');
  const [childSeats, setChildSeats] = useState<ChildSeat[]>([]);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<'unassigned' | 'assigned'>('unassigned');
  const [serviceType, setServiceType] = useState<ServiceType>('point_to_point');
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('business');
  const [fare, setFare] = useState('');
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [makePayment, setMakePayment] = useState(true);
  const [rentalHours, setRentalHours] = useState('3');

  useEffect(() => {
    let active = true;
    void Promise.all([listDrivers(), listVehicles(), listPartners()]).then(([d, v, p]) => { if (active) { setDrivers(d.items); setVehicles(v.items); setPartners(p.items); } }).catch((value) => { if (active) setError(value instanceof Error ? value.message : 'Could not load booking options.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedDriver = useMemo(() => drivers.find((row) => row.id === Number(driverId)), [driverId, drivers]);
  const isRental = serviceType === 'hourly' || serviceType === 'full_day';
  const filteredVehicles = useMemo(() => vehicles.filter((row) => !row.service_class || row.service_class === vehicleClass), [vehicleClass, vehicles]);
  const chooseDriver = (value: string) => {
    setDriverId(value);
    const driver = drivers.find((row) => row.id === Number(value));
    if (driver?.vehicle?.id) setVehicleId(String(driver.vehicle.id));
  };
  const estimate = async () => {
    if (!pickup || !dropoff || !scheduledAt) { setError('Select pickup, drop-off and schedule first.'); return; }
    setEstimating(true); setError('');
    try { const result = await estimateRoute({ pickup, dropoff, stops: stops.filter((row): row is Place => Boolean(row)), vehicle_id: vehicleId ? Number(vehicleId) : null, scheduled_at: dubaiIso(scheduledAt) }); setFare(String(result.fare)); setDistance(String(result.distanceKm)); setDuration(String(result.durationMin)); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not estimate the route.'); }
    finally { setEstimating(false); }
  };
  const reset = () => { setCustomerName(''); setCustomerPhone(''); setCustomerEmail(''); setPickup(null); setDropoff(null); setStops([]); setScheduledAt(defaultSchedule()); setGuests('1'); setLuggage('0'); setChildSeats([]); setPartnerId(''); setDriverId(''); setVehicleId(''); setAssignmentMode('unassigned'); setServiceType('point_to_point'); setVehicleClass('business'); setFare(''); setDistance(''); setDuration(''); setNotes(''); setRentalHours('3'); setResult(null); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setResult(null);
    if (!pickup || !dropoff) { setError('Select both pickup and drop-off from the address suggestions.'); return; }
    if (!partnerId) { setError('Select the account responsible for this booking. Use Z Plus - Direct Guest for direct customers.'); return; }
    if (stops.some((row) => !row)) { setError('Select every intermediate stop from the address suggestions, or remove the empty stop.'); return; }
    if (assignmentMode === 'assigned' && (!driverId || !vehicleId)) { setError('Select both driver and vehicle, or keep the booking unassigned.'); return; }
    const numericFare = Number(fare); const numericDistance = isRental ? 0 : Number(distance); const numericDuration = isRental ? Number(rentalHours) * 60 : Number(duration);
    if (!(numericFare > 0) || !(numericDistance >= 0) || !(numericDuration >= 0)) { setError(isRental ? 'Enter a valid rental price and duration.' : 'Estimate the route or enter a valid fare, distance and duration.'); return; }
    setSaving(true);
    setResult({ status: 'creating_booking' });
    try {
      const booking = await createBooking({
        driver_id: assignmentMode === 'assigned' ? Number(driverId) : null, vehicle_id: assignmentMode === 'assigned' ? Number(vehicleId) : null, partner_id: Number(partnerId), account_id: Number(partnerId),
        booking_type: isRental ? 'rental' : serviceType.startsWith('airport_') ? 'airport_transfer' : 'normal', service_type: serviceType, vehicle_class: vehicleClass, customer_name: customerName.trim(), customer_phone: customerPhone.trim(), customer_email: customerEmail.trim() || null,
        pickup, dropoff, stops: stops.filter((row): row is Place => Boolean(row)), scheduled_at: dubaiIso(scheduledAt), guest_count: Number(guests) || 1, luggage_count: Number(luggage) || 0, child_seats: childSeats,
        fare: numericFare, distance_km: numericDistance, duration_min: numericDuration, rental_duration_hours: isRental ? Number(rentalHours) : null, notes: notes.trim() || null, notify_driver: assignmentMode === 'assigned' && notify,
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
        <section className="card p-5 lg:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-gold-dark">Step 1</p>
          <h2 className="mt-1 font-display text-xl font-bold">Account & service</h2>
          <p className="mt-1 text-xs text-slate-500">Select who owns this reservation before entering the guest.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label><span className="label">Account *</span><select required className="field" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}><option value="">Select account</option>{partners.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label><span className="label">Service type *</span><select className="field" value={serviceType} onChange={(e) => { const next = e.target.value as ServiceType; setServiceType(next); if (next === 'full_day') setRentalHours('24'); else if (next === 'hourly' && rentalHours === '24') setRentalHours('3'); setDistance(''); setDuration(''); }}><option value="airport_pickup">Airport pickup</option><option value="airport_dropoff">Airport drop off</option><option value="point_to_point">Point to point</option><option value="hourly">Hourly</option><option value="full_day">Full day</option></select></label>
          </div>
        </section>
        <section className="card p-5 lg:p-6"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-gold-soft p-2.5 text-gold-dark"><UserCircle size={22} /></div><div><h2 className="font-display font-bold">Guest & requirements</h2><p className="text-xs text-slate-500">Contact details and passenger needs.</p></div></div><div className="grid gap-4 md:grid-cols-3"><label><span className="label">Full name *</span><input required className="field" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" /></label><label><span className="label">Phone *</span><input required className="field" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+971…" /></label><label><span className="label">Email</span><input type="email" className="field" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="customer@email.com" /></label><label><span className="label">Guests *</span><input required type="number" min="1" max="99" className="field" value={guests} onChange={(e) => setGuests(e.target.value)} /></label><label><span className="label">Luggage</span><input type="number" min="0" max="99" className="field" value={luggage} onChange={(e) => setLuggage(e.target.value)} /></label></div><div className="mt-4"><div className="flex items-center justify-between"><span className="label">Child seats</span>{childSeats.length < 4 && <button type="button" onClick={() => setChildSeats((rows) => [...rows, { type: 'infant', quantity: 1 }])} className="text-xs font-bold text-gold-dark">+ Add child seat</button>}</div>{childSeats.map((seat, index) => <div key={index} className="mt-2 grid grid-cols-[1fr_90px_auto] gap-2"><select className="field" value={seat.type} onChange={(e) => setChildSeats((rows) => rows.map((row, i) => i === index ? { ...row, type: e.target.value as ChildSeatType } : row))}><option value="front_facing">Front facing child seat</option><option value="rear_facing">Rear facing child seat</option><option value="infant">Infant seat</option><option value="booster">Booster</option></select><input aria-label="Seat count" type="number" min="1" max="10" className="field" value={seat.quantity} onChange={(e) => setChildSeats((rows) => rows.map((row, i) => i === index ? { ...row, quantity: Number(e.target.value) || 1 } : row))} /><button type="button" onClick={() => setChildSeats((rows) => rows.filter((_, i) => i !== index))} className="rounded-xl px-3 text-xs font-bold text-red-600 hover:bg-red-50">Remove</button></div>)}</div></section>
        <section className="card p-5 lg:p-6"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><MapPin size={22} /></div><div><h2 className="font-display font-bold">Journey</h2><p className="text-xs text-slate-500">Pickup, ordered intermediate stops and final drop-off.</p></div></div><div className="grid gap-4 md:grid-cols-2"><PlaceField label="Pickup" value={pickup} onChange={setPickup} /><PlaceField label={isRental ? 'Planned final drop-off' : 'Drop-off'} value={dropoff} onChange={setDropoff} /></div><div className="mt-4 space-y-3">{stops.map((stop, index) => <div key={index} className="grid grid-cols-[1fr_auto] items-end gap-2"><PlaceField label={`Stop ${index + 1}`} value={stop} onChange={(place) => setStops((rows) => rows.map((row, i) => i === index ? place : row))} /><button type="button" onClick={() => setStops((rows) => rows.filter((_, i) => i !== index))} className="btn-secondary mb-px h-[50px] px-3">Remove</button></div>)}{stops.length < 15 && <button type="button" onClick={() => setStops((rows) => [...rows, null])} className="btn-secondary">+ Add intermediate stop</button>}</div><div className="mt-4 grid gap-4 md:grid-cols-2"><label><span className="label">{isRental ? 'Service start *' : 'Pickup date & time *'}</span><input required type="datetime-local" className="field" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>{isRental && <label><span className="label">Duration *</span><select className="field" disabled={serviceType === 'full_day'} value={serviceType === 'full_day' ? '24' : rentalHours} onChange={(e) => { setRentalHours(e.target.value); setDuration(String(Number(e.target.value) * 60)); }}>{Array.from({ length: 43 }, (_, index) => 3 + index * .5).map((hours) => <option key={hours} value={hours}>{hours === 24 ? 'Full day (24 hours)' : `${hours} hours`}</option>)}</select></label>}</div>{isRental && scheduledAt && <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900"><strong>Planned window:</strong> {formatRentalWindow(scheduledAt, Number(serviceType === 'full_day' ? 24 : rentalHours))}</div>}</section>
        <section className="card p-5 lg:p-6"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><BellRinging size={22} /></div><div><h2 className="font-display font-bold">Dispatch assignment</h2><p className="text-xs text-slate-500">Keep confirmed work in dispatch, or release it to a driver now.</p></div></div><div className="grid gap-4 md:grid-cols-2"><label><span className="label">Assignment status</span><select className="field" value={assignmentMode} onChange={(e) => { const mode = e.target.value as 'unassigned' | 'assigned'; setAssignmentMode(mode); if (mode === 'unassigned') { setDriverId(''); setVehicleId(''); setNotify(false); } }}><option value="unassigned">Unassigned — dispatch only</option><option value="assigned">Assigned — visible to driver</option></select></label><label><span className="label">Requested vehicle class *</span><select className="field" value={vehicleClass} onChange={(e) => { setVehicleClass(e.target.value as VehicleClass); setVehicleId(''); }}><option value="eco">Eco Class</option><option value="business">Business Class</option><option value="first">First Class</option><option value="exotic">Exotic Class</option><option value="suv">SUV</option><option value="van">Van</option><option value="luxury_bus">Luxury Bus</option></select></label>{assignmentMode === 'assigned' && <><label><span className="label">Driver *</span><select required className="field" value={driverId} onChange={(e) => chooseDriver(e.target.value)}><option value="">Select driver</option>{drivers.map((row) => <option key={row.id} value={row.id}>{row.first_name} {row.last_name}{row.vehicle ? ` · ${row.vehicle.license_plate}` : ''}</option>)}</select></label><label><span className="label">Vehicle *</span><select required className="field" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}><option value="">Select matching vehicle</option>{filteredVehicles.map((row) => <option key={row.id} value={row.id}>{row.license_plate} · {row.vehicle_model}{row.service_class ? ` · ${row.service_class.replaceAll('_', ' ')}` : ''}</option>)}</select></label></>}</div>{selectedDriver && !selectedDriver.vehicle && <p className="mt-3 text-xs font-semibold text-amber-700">This driver has no current vehicle assignment. Select the booking vehicle manually.</p>}<label className="mt-4 block"><span className="label">Booking notes</span><textarea className="field min-h-24 resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Flight, room, signboard or special instructions" /></label></section>
      </div>
      <aside className="space-y-6">
        <section className="card p-5 lg:sticky lg:top-24"><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Wallet size={22} /></div><div><h2 className="font-display font-bold">Price & finish</h2><p className="text-xs text-slate-500">{isRental ? 'Enter the agreed service price.' : 'Review the route price.'}</p></div></div>{!isRental && <button type="button" disabled={estimating} onClick={() => void estimate()} className="btn-secondary w-full">{estimating ? <Spinner className="animate-spin" /> : <Calculator />} Estimate route & fare</button>}<div className="mt-4 grid grid-cols-2 gap-3"><label className="col-span-2"><span className="label">{isRental ? 'Agreed price (AED) *' : 'Fare (AED) *'}</span><input required type="number" min="0.01" step="0.01" className="field text-lg font-bold" value={fare} onChange={(e) => setFare(e.target.value)} /></label>{!isRental && <><label><span className="label">Distance km *</span><input type="number" min="0" step="0.1" className="field" value={distance} onChange={(e) => setDistance(e.target.value)} /></label><label><span className="label">Duration min *</span><input type="number" min="0" className="field" value={duration} onChange={(e) => setDuration(e.target.value)} /></label></>}</div>{isRental && <div className="mt-4 rounded-xl bg-violet-50 p-4 text-sm"><span className="text-xs font-bold uppercase tracking-wider text-violet-600">Rental summary</span><strong className="mt-1 block text-violet-950">{serviceType === 'full_day' || rentalHours === '24' ? 'Full day' : `${rentalHours} hours`} · AED {Number(fare || 0).toLocaleString('en-AE')}</strong><span className="mt-1 block text-xs text-violet-700">Extensions are stored as separate immutable invoice events.</span></div>}<div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">{assignmentMode === 'assigned' && <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1 accent-gold" /><span><strong className="block text-sm">Notify driver</strong><span className="text-xs text-slate-500">Send assignment notification after creation.</span></span></label>}<label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={makePayment} onChange={(e) => setMakePayment(e.target.checked)} className="mt-1 accent-gold" /><span><strong className="block text-sm">Create payment link</strong><span className="text-xs text-slate-500">Issue invoice and secure CCAvenue link.</span></span></label></div><button disabled={saving} className="btn-gold mt-5 h-12 w-full">{saving ? <><Spinner className="animate-spin" /> Creating…</> : <>Create {isRental ? 'rental' : 'booking'}</>}</button><p className="mt-3 text-center text-[11px] leading-4 text-slate-400">CCAvenue shipping details are prefilled from the guest and destination.</p></section>
      </aside>
    </form>
    {result && <BookingResultModal result={result} driverName={selectedDriver ? `${selectedDriver.first_name} ${selectedDriver.last_name}`.trim() : ''} vehicle={vehicles.find((row) => row.id === Number(vehicleId)) || null} notify={assignmentMode === 'assigned' && notify} bookingMode={isRental ? 'rental' : 'normal'} rentalHours={Number(serviceType === 'full_day' ? 24 : rentalHours)} assignmentMode={assignmentMode} onClose={() => setResult(null)} onReset={reset} />}
  </div>;
}

function BookingResultModal({ result, driverName, vehicle, notify, bookingMode, rentalHours, assignmentMode, onClose, onReset }: { result: SubmissionResult; driverName: string; vehicle: Vehicle | null; notify: boolean; bookingMode: 'normal' | 'rental'; rentalHours: number; assignmentMode: 'unassigned' | 'assigned'; onClose: () => void; onReset: () => void }) {
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
        {successful && (assignmentMode === 'assigned' ? `Driver and vehicle are assigned${notify ? ', and the driver notification was requested' : ''}.` : 'Booking is saved in dispatch and is not yet visible to a driver.')}
        {partial && `The booking and assignment are safe, but the payment link failed: ${result.message}`}
        {result.status === 'error' && result.message}
      </p>

      {(successful || partial) && <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Booking</span><strong className="mt-1 block">#{result.bookingId}</strong></div>
        <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Status</span><span className={`pill mt-1 ${successful ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{successful ? 'Created' : 'Payment action needed'}</span></div>
        <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Driver</span><strong className="mt-1 block">{assignmentMode === 'assigned' ? (driverName || 'Assigned') : 'Unassigned'}</strong></div>
        <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Vehicle</span><strong className="mt-1 block">{assignmentMode === 'assigned' && vehicle ? `${vehicle.license_plate} · ${vehicle.vehicle_model}` : 'Awaiting dispatch'}</strong></div>
        {bookingMode === 'rental' && <div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Rental duration</span><strong className="mt-1 block">{rentalHours === 24 ? 'Full day (24 hours)' : `${rentalHours} hours`}</strong></div>}
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

function formatRentalWindow(startValue: string, hours: number): string {
  const start = new Date(dubaiIso(startValue));
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  const format = (value: Date) => value.toLocaleString('en-AE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' });
  return `${format(start)} → ${format(end)}`;
}
