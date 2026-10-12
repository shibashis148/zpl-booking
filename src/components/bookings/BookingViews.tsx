import {
  AirplaneTilt,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  Columns,
  DotsSixVertical,
  Eye,
  ListBullets,
  Spinner,
  SquaresFour,
  UserCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { useMemo, useState, type DragEvent } from 'react';
import type { Booking, TripFinance } from '../../services/api';

export type BookingView = 'list' | 'board' | 'calendar' | 'status';

const views: Array<{ value: BookingView; label: string; icon: typeof ListBullets }> = [
  { value: 'list', label: 'List', icon: ListBullets },
  { value: 'board', label: 'Dispatch board', icon: Columns },
  { value: 'calendar', label: 'Calendar', icon: CalendarBlank },
  { value: 'status', label: 'Status overview', icon: SquaresFour },
];

const statusTone: Record<Booking['status'], string> = {
  scheduled: 'border-blue-200 bg-blue-50 text-blue-700',
  in_progress: 'border-violet-200 bg-violet-50 text-violet-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
};

const statusLabel: Record<Booking['status'], string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const formatTime = (value?: string | null) => value
  ? new Date(value).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
  : 'Time pending';

const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' })
  : 'Date pending';

function dateKey(value?: string | null): string {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function BookingViewTabs({ value, onChange }: { value: BookingView; onChange: (value: BookingView) => void }) {
  return <div className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm lg:w-auto">
    {views.map(({ value: option, label, icon: Icon }) => <button key={option} type="button" onClick={() => onChange(option)} className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition lg:flex-none ${value === option ? 'bg-navy text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-navy'}`}><Icon size={17} weight={value === option ? 'fill' : 'regular'} />{label}</button>)}
  </div>;
}

type ViewProps = {
  rows: Booking[];
  money: Record<number, TripFinance>;
  busyAction: string | null;
  onView: (row: Booking) => void;
  onMove: (row: Booking, status: Booking['status']) => void;
};

export function BookingBoard({ rows, money, busyAction, onView, onMove }: ViewProps) {
  const [over, setOver] = useState<Booking['status'] | null>(null);
  const columns: Booking['status'][] = ['scheduled', 'in_progress', 'completed', 'cancelled'];
  const drop = (event: DragEvent, target: Booking['status']) => {
    event.preventDefault(); setOver(null);
    const row = rows.find((item) => item.id === event.dataTransfer.getData('text/booking-id'));
    if (row && row.status !== target) onMove(row, target);
  };
  return <div className="grid min-w-[1040px] grid-cols-4 gap-4">
    {columns.map((column) => {
      const items = rows.filter((row) => row.status === column);
      return <section key={column} onDragOver={(event) => { event.preventDefault(); setOver(column); }} onDragLeave={() => setOver(null)} onDrop={(event) => drop(event, column)} className={`min-h-[520px] rounded-2xl border p-3 transition ${over === column ? 'border-gold bg-gold/5 ring-4 ring-gold/10' : 'border-slate-200 bg-slate-100/70'}`}>
        <div className="mb-3 flex items-center justify-between px-1"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${column === 'scheduled' ? 'bg-blue-500' : column === 'in_progress' ? 'bg-violet-500' : column === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} /><h2 className="text-sm font-extrabold text-slate-800">{statusLabel[column]}</h2></div><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500 shadow-sm">{items.length}</span></div>
        <div className="space-y-3">{items.map((row) => <BookingCard key={row.id} row={row} entry={money[Number(row.id)]} busy={busyAction === `${row.id}:move`} onView={onView} onMove={onMove} />)}{!items.length && <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-5 text-center text-xs font-semibold text-slate-400">Drop a booking here</div>}</div>
      </section>;
    })}
  </div>;
}

function BookingCard({ row, entry, busy, onView, onMove }: { row: Booking; entry?: TripFinance; busy: boolean; onView: (row: Booking) => void; onMove: (row: Booking, status: Booking['status']) => void }) {
  return <article draggable={!busy} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/booking-id', row.id); }} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${busy ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><DotsSixVertical className="shrink-0 text-slate-300" size={19} /><div className="min-w-0"><span className="block text-[10px] font-extrabold uppercase tracking-wider text-gold-dark">#{row.id} · {row.serviceType.replaceAll('_', ' ')}</span><strong className="mt-0.5 block truncate text-sm">{row.customerName}</strong></div></div>{busy && <Spinner className="shrink-0 animate-spin text-gold-dark" />}</div>
    <div className="mt-3 rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-700"><Clock className="text-gold-dark" />{formatDate(row.scheduledAt)} · {formatTime(row.scheduledAt)}</div>{row.flightNo && <div className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-700"><AirplaneTilt /> {row.airportCode || 'Airport'} · {row.flightNo} · {row.flightTracking?.status?.replaceAll('_', ' ') || 'tracking pending'}</div>}<p className="mt-2 truncate text-xs text-slate-600">{row.pickup.address}</p><p className="mt-1 truncate text-xs text-slate-400">→ {row.drop.address}</p></div>
    <div className="mt-3 flex flex-wrap gap-2"><span className={`pill ${row.assignmentStatus === 'unassigned' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><UserCircle />{row.driverName || 'Unassigned'}</span><span className={`pill ${entry?.totals.outstanding ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{entry?.totals.outstanding ? `AED ${entry.totals.outstanding.toLocaleString('en-AE')} due` : 'No balance due'}</span></div>
    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2"><select aria-label={`Move booking ${row.id}`} disabled={busy} value={row.status} onChange={(event) => onMove(row, event.target.value as Booking['status'])} className="min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-600"><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><button type="button" onClick={() => onView(row)} className="btn-primary px-3 py-2 text-xs"><Eye /> View</button></div>
  </article>;
}

export function BookingCalendar({ rows, onView }: Pick<ViewProps, 'rows' | 'onView'>) {
  const now = new Date();
  const [anchor, setAnchor] = useState(() => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const days = useMemo(() => {
    const firstWeekday = anchor.getUTCDay();
    return Array.from({ length: 42 }, (_, index) => new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), index - firstWeekday + 1)));
  }, [anchor]);
  const byDay = useMemo(() => rows.reduce<Record<string, Booking[]>>((result, row) => {
    const key = dateKey(row.scheduledAt);
    if (key) (result[key] ||= []).push(row);
    return result;
  }, {}), [rows]);
  const title = anchor.toLocaleDateString('en-AE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const changeMonth = (value: number) => setAnchor(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + value, 1)));
  const reset = () => setAnchor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  return <section className="card overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h2 className="font-display text-xl font-extrabold">{title}</h2><p className="text-xs text-slate-500">Pickup schedule shown in Dubai time.</p></div><div className="flex gap-2"><button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="btn-secondary px-3"><CaretLeft /></button><button type="button" onClick={reset} className="btn-secondary px-3">Today</button><button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="btn-secondary px-3"><CaretRight /></button></div></div>
    <div className="grid min-w-[840px] grid-cols-7 border-b border-slate-200 bg-slate-50">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="px-3 py-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{day}</div>)}</div>
    <div className="grid min-w-[840px] grid-cols-7">{days.map((day) => {
      const key = day.toISOString().slice(0, 10);
      const items = (byDay[key] || []).sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
      const currentMonth = day.getUTCMonth() === anchor.getUTCMonth();
      const today = key === dateKey(new Date().toISOString());
      return <div key={key} className={`min-h-32 border-b border-r border-slate-100 p-2 ${currentMonth ? 'bg-white' : 'bg-slate-50/70'}`}><div className={`mb-2 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${today ? 'bg-gold text-navy' : currentMonth ? 'text-slate-700' : 'text-slate-300'}`}>{day.getUTCDate()}</div><div className="space-y-1.5">{items.map((row) => <button key={row.id} type="button" onClick={() => onView(row)} className={`group block w-full rounded-lg border px-2 py-1.5 text-left text-[11px] transition hover:shadow-sm ${statusTone[row.status]}`}><span className="flex items-center justify-between gap-1 font-extrabold"><span>{formatTime(row.scheduledAt)}</span><Eye className="opacity-60 group-hover:opacity-100" /></span><span className="mt-0.5 block truncate font-semibold">{row.customerName}</span></button>)}</div></div>;
    })}</div>
  </section>;
}

export function BookingStatusOverview({ rows, money, onView }: Pick<ViewProps, 'rows' | 'money' | 'onView'>) {
  const cards: Array<{ status: Booking['status']; icon: typeof Clock }> = [
    { status: 'scheduled', icon: Clock }, { status: 'in_progress', icon: WarningCircle },
    { status: 'completed', icon: CheckCircle }, { status: 'cancelled', icon: WarningCircle },
  ];
  const unassigned = rows.filter((row) => row.assignmentStatus === 'unassigned').length;
  const unpaid = rows.filter((row) => (money[Number(row.id)]?.totals.outstanding || 0) > 0).length;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ status, icon: Icon }) => {
      const items = rows.filter((row) => row.status === status);
      return <section key={status} className={`rounded-2xl border p-5 ${statusTone[status]}`}><div className="flex items-center justify-between"><Icon size={24} weight="duotone" /><span className="text-3xl font-extrabold">{items.length}</span></div><h2 className="mt-4 font-display text-base font-extrabold">{statusLabel[status]}</h2><p className="mt-1 text-xs opacity-80">{items.length === 1 ? '1 booking' : `${items.length} bookings`} in this stage</p></section>;
    })}</div>
    <div className="grid gap-4 md:grid-cols-2"><section className="card p-5"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Dispatch attention</span><strong className="mt-2 block text-2xl">{unassigned} unassigned</strong><p className="mt-1 text-sm text-slate-500">Confirmed work still waiting for driver and vehicle assignment.</p></section><section className="card p-5"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Receivables attention</span><strong className="mt-2 block text-2xl">{unpaid} with balance due</strong><p className="mt-1 text-sm text-slate-500">Open the booking to review invoice lines and payment links.</p></section></div>
    <section className="card overflow-hidden"><div className="border-b border-slate-200 p-5"><h2 className="font-display text-lg font-extrabold">Booking record</h2><p className="text-xs text-slate-500">Every tile has an explicit details action.</p></div><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><span className="text-[10px] font-extrabold uppercase tracking-wider text-gold-dark">#{row.id}</span><strong className="mt-1 block truncate text-sm">{row.customerName}</strong></div><span className={`pill ${statusTone[row.status]}`}>{statusLabel[row.status]}</span></div><p className="mt-3 truncate text-xs text-slate-500">{formatDate(row.scheduledAt)} · {formatTime(row.scheduledAt)}</p><button type="button" onClick={() => onView(row)} className="btn-secondary mt-4 w-full px-3 py-2 text-xs"><Eye /> View details</button></div>)}</div></section>
  </div>;
}
