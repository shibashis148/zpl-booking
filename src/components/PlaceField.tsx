import { MapPin, Spinner } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { placeDetails, searchPlaces, type Place, type PlaceSuggestion } from '../services/api';

export default function PlaceField({ label, value, onChange }: { label: string; value: Place | null; onChange: (place: Place | null) => void }) {
  const [text, setText] = useState(value?.address || '');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const session = useRef('');
  const sequence = useRef(0);
  useEffect(() => { if (value?.address && value.address !== text) setText(value.address); }, [value?.address]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const query = text.trim();
    if (value?.address === query || query.length < 2) { setItems([]); setBusy(false); return; }
    if (!session.current) session.current = globalThis.crypto.randomUUID();
    const current = ++sequence.current;
    const timer = window.setTimeout(() => {
      setBusy(true);
      void searchPlaces(query, session.current)
        .then((rows) => { if (sequence.current === current) { setItems(rows); setOpen(true); } })
        .catch(() => { if (sequence.current === current) setItems([]); })
        .finally(() => { if (sequence.current === current) setBusy(false); });
    }, 320);
    return () => window.clearTimeout(timer);
  }, [text, value?.address]);
  const choose = async (item: PlaceSuggestion) => {
    setText(item.description); setOpen(false); setBusy(true);
    try { const details = await placeDetails(item.placeId, session.current); onChange({ address: details.address || item.description, label, lat: details.lat, lng: details.lng }); setText(details.address || item.description); session.current = globalThis.crypto.randomUUID(); }
    finally { setBusy(false); }
  };
  return <label className="relative block"><span className="label">{label}</span><div className="relative"><MapPin className="absolute left-3.5 top-3.5 text-gold-dark" size={19} /><input value={text} onFocus={() => setOpen(Boolean(items.length))} onChange={(e) => { setText(e.target.value); onChange(null); }} className="field pl-11 pr-10" placeholder={`Search ${label.toLowerCase()}`} />{busy && <Spinner className="absolute right-3.5 top-3.5 animate-spin text-slate-400" />}</div>
    {open && items.length > 0 && <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{items.map((item) => <button key={item.placeId} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void choose(item)} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"><span className="block text-sm font-semibold text-slate-800">{item.mainText}</span><span className="block truncate text-xs text-slate-500">{item.secondaryText}</span></button>)}</div>}
  </label>;
}
