import { CheckCircle, MapPin, Spinner, WarningCircle, X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { placeDetails, searchPlaces, type Place, type PlaceSuggestion } from '../services/api';

export default function PlaceField({ label, value, onChange }: { label: string; value: Place | null; onChange: (place: Place | null) => void }) {
  const [text, setText] = useState(value?.address || '');
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const fieldId = useId();
  const root = useRef<HTMLDivElement>(null);
  const session = useRef('');
  const sequence = useRef(0);
  const editing = useRef(false);

  useEffect(() => {
    if (editing.current && value === null) return;
    const next = value?.address || '';
    setText(next);
    setItems([]);
    setOpen(false);
    setError('');
    editing.current = false;
    sequence.current += 1;
  }, [value]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => {
    const query = text.trim();
    if (!editing.current || query.length < 2) {
      setItems([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    if (!session.current) session.current = globalThis.crypto.randomUUID();
    const current = ++sequence.current;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setError('');
      void searchPlaces(query, session.current)
        .then((rows) => {
          if (sequence.current !== current || !editing.current) return;
          const unique = rows.filter((row, index, all) => all.findIndex((candidate) => candidate.placeId === row.placeId) === index);
          setItems(unique);
          setOpen(unique.length > 0);
        })
        .catch(() => {
          if (sequence.current !== current) return;
          setItems([]);
          setOpen(false);
          setError('Could not search places. Please try again.');
        })
        .finally(() => { if (sequence.current === current) setSearching(false); });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      if (sequence.current === current) setSearching(false);
    };
  }, [text]);

  const choose = async (item: PlaceSuggestion) => {
    sequence.current += 1;
    editing.current = false;
    setSearching(false);
    setSelecting(true);
    setText(item.description);
    setItems([]);
    setOpen(false);
    setError('');
    try {
      const details = await placeDetails(item.placeId, session.current);
      const address = details.address || item.description;
      setText(address);
      onChange({ address, label, lat: details.lat, lng: details.lng });
      session.current = globalThis.crypto.randomUUID();
    } catch (value) {
      editing.current = true;
      onChange(null);
      setError(value instanceof Error ? value.message : 'Could not select this place. Please try again.');
    } finally {
      setSelecting(false);
    }
  };

  const clear = () => {
    sequence.current += 1;
    editing.current = false;
    setText('');
    setItems([]);
    setOpen(false);
    setSearching(false);
    setError('');
    onChange(null);
  };

  return <div ref={root} className="relative block">
    <label id={`${fieldId}-label`} htmlFor={fieldId} className="label">{label}</label>
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3.5 top-3.5 text-gold-dark" size={19} />
      <input
        id={fieldId}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${fieldId}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        onFocus={() => { if (editing.current && items.length) setOpen(true); }}
        onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
        onChange={(event) => {
          editing.current = true;
          sequence.current += 1;
          setText(event.target.value);
          setItems([]);
          setOpen(false);
          setError('');
          onChange(null);
        }}
        className={`field pl-11 pr-10 ${value ? 'border-emerald-300 bg-emerald-50/30' : ''}`}
        placeholder={`Search ${label.toLowerCase()}`}
      />
      {(searching || selecting) && <Spinner aria-label={selecting ? `Selecting ${label}` : `Searching ${label}`} className="absolute right-3.5 top-3.5 animate-spin text-slate-400" />}
      {!searching && !selecting && value && <CheckCircle weight="fill" className="absolute right-3.5 top-3.5 text-emerald-500" />}
      {!searching && !selecting && text && !value && <button type="button" aria-label={`Clear ${label}`} onClick={clear} className="absolute right-2.5 top-2.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>}
    </div>
    {error && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><WarningCircle /> {error}</p>}
    {open && items.length > 0 && <div id={`${fieldId}-listbox`} role="listbox" aria-labelledby={`${fieldId}-label`} className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
      {items.map((item) => <button key={item.placeId} type="button" role="option" aria-selected="false" onPointerDown={(event) => event.preventDefault()} onClick={() => void choose(item)} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"><span className="block text-sm font-semibold text-slate-800">{item.mainText}</span><span className="block truncate text-xs text-slate-500">{item.secondaryText}</span></button>)}
    </div>}
  </div>;
}
