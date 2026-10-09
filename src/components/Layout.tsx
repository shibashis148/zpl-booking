import { CalendarPlus, CarProfile, Handshake, SignOut, UserCircle } from '@phosphor-icons/react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from './Brand';

const nav = [
  { to: '/new', label: 'New booking', icon: CalendarPlus },
  { to: '/bookings', label: 'Trips & payments', icon: CarProfile },
  { to: '/partners', label: 'Partners', icon: Handshake },
];

export default function Layout() {
  const { user, logout } = useAuth();
  return <div className="min-h-screen bg-canvas">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy px-4 py-6 text-white lg:flex">
      <div className="px-2"><Brand /></div>
      <nav className="mt-9 space-y-1.5">
        {nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${isActive ? 'bg-white text-navy shadow' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><Icon size={20} weight="duotone" />{label}</NavLink>)}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2.5"><UserCircle size={28} className="text-gold" /><div className="min-w-0"><p className="truncate text-sm font-bold">{user?.full_name || 'Booking manager'}</p><p className="truncate text-xs text-slate-400">{user?.email}</p></div></div>
        <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10"><SignOut /> Sign out</button>
      </div>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
        <div className="lg:hidden"><Brand dark={false} /></div>
        <nav className="flex gap-1 overflow-x-auto lg:hidden">{nav.map(({ to, label }) => <NavLink key={to} to={to} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${isActive ? 'bg-gold-soft text-gold-dark' : 'text-slate-500'}`}>{label}</NavLink>)}</nav>
        <div className="ml-auto hidden items-center gap-2 text-xs font-semibold text-slate-500 lg:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Core connected</div>
      </header>
      <main className="mx-auto max-w-[1500px] p-4 lg:p-8"><Outlet /></main>
    </div>
  </div>;
}
