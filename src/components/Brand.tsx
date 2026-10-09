export default function Brand({ compact = false, dark = true }: { compact?: boolean; dark?: boolean }) {
  return <div className="flex items-center gap-3">
    <img src="/zplus-logo.svg" alt="ZPlusLimo" className="h-10 w-10 object-contain" />
    {!compact && <div><p className={`font-display text-base font-extrabold leading-none ${dark ? 'text-white' : 'text-ink'}`}>ZPlus<span className="text-gold">Limo</span></p><p className={`mt-1 text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Booking Desk</p></div>}
  </div>;
}
