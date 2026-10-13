import { Spinner, X } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';
import {
  createFleetDriver,
  createFleetVehicle,
  createTransportSupplier,
  type Driver,
  type TransportSupplier,
  type Vehicle,
  type VehicleClass,
} from '../services/api';

interface Props {
  suppliers: TransportSupplier[];
  vehicleClass: VehicleClass;
  onClose: () => void;
  onCreated: (value: { supplier: TransportSupplier; vehicle: Vehicle; driver: Driver | null }) => void;
}

export default function B2BQuickAddModal({ suppliers, vehicleClass, onClose, onCreated }: Props) {
  const [supplierId, setSupplierId] = useState(suppliers[0] ? String(suppliers[0].id) : 'new');
  const [supplierName, setSupplierName] = useState('');
  const [contactName, setContactName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [addChauffeur, setAddChauffeur] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const supplier = supplierId === 'new'
        ? await createTransportSupplier({
          name: supplierName.trim(),
          contact_name: contactName.trim() || null,
          phone: supplierPhone.trim() || null,
          approval_status: 'approved',
          is_active: true,
        })
        : suppliers.find((row) => row.id === Number(supplierId));
      if (!supplier) throw new Error('Select or create a transport supplier.');
      const vehicle = await createFleetVehicle({
        license_plate: plate.trim(),
        vehicle_model: model.trim(),
        service_class: vehicleClass,
        source_type: 'b2b',
        supplier_id: supplier.id,
        is_active: true,
      });
      const driver = addChauffeur
        ? await createFleetDriver({
          name: driverName.trim(),
          phone_number: driverPhone.trim(),
          email: driverEmail.trim() || null,
          source_type: 'b2b',
          supplier_id: supplier.id,
        })
        : null;
      onCreated({ supplier, vehicle, driver });
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not add the B2B assignment.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
    <form onSubmit={submit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><span className="pill bg-violet-50 text-violet-700">B2B fleet</span><h2 className="mt-3 font-display text-2xl font-extrabold">Add supplier vehicle</h2><p className="mt-1 text-sm text-slate-500">The vehicle stays in the shared fleet list, clearly tagged as B2B.</p></div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100"><X size={22} /></button>
      </div>
      {error && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="label">Transport supplier *</span><select className="field" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}<option value="new">+ Create new supplier</option></select></label>
        {supplierId === 'new' && <><label><span className="label">Supplier name *</span><input required className="field" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Company name" /></label><label><span className="label">Contact person</span><input className="field" value={contactName} onChange={(event) => setContactName(event.target.value)} /></label><label className="sm:col-span-2"><span className="label">Supplier phone</span><input className="field" value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} placeholder="+971…" /></label></>}
        <div className="sm:col-span-2 border-t border-slate-200 pt-4"><h3 className="font-display font-bold">Vehicle</h3><p className="text-xs text-slate-500">Class is taken from the booking: {vehicleClass.replaceAll('_', ' ')}.</p></div>
        <label><span className="label">Registration plate *</span><input required className="field uppercase" value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} /></label>
        <label><span className="label">Make & model *</span><input required className="field" value={model} onChange={(event) => setModel(event.target.value)} placeholder="Mercedes V-Class" /></label>
        <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4"><input type="checkbox" checked={addChauffeur} onChange={(event) => setAddChauffeur(event.target.checked)} className="mt-1 accent-gold" /><span><strong className="block text-sm">Also add supplier chauffeur</strong><span className="text-xs text-slate-500">Leave this off when an internal Z Plus driver will use the B2B vehicle.</span></span></label>
        {addChauffeur && <><label><span className="label">Chauffeur name *</span><input required className="field" value={driverName} onChange={(event) => setDriverName(event.target.value)} /></label><label><span className="label">Chauffeur phone *</span><input required className="field" value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} placeholder="+971…" /></label><label className="sm:col-span-2"><span className="label">Email (optional)</span><input type="email" className="field" value={driverEmail} onChange={(event) => setDriverEmail(event.target.value)} /></label></>}
      </div>
      <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button disabled={saving} className="btn-gold">{saving ? <><Spinner className="animate-spin" /> Adding…</> : 'Add and select'}</button></div>
    </form>
  </div>;
}
