export interface User {
  id: number;
  email: string;
  full_name: string | null;
  primary_role: string;
  roles: string[];
}

export interface Paginated<T> { items: T[]; total: number; page: number; page_size: number; total_pages: number }
export interface Driver { id: number; first_name: string; last_name: string; phone_number: string; is_active: boolean; vehicle: Vehicle | null }
export interface Vehicle { id: number; license_plate: string; vehicle_model: string; service_class: VehicleClass | null; driver_id: number | null; is_active: boolean }
export interface Partner { id: number; name: string; partner_type: string; email: string | null; phone: string | null; address: string | null; representative: string | null; billing_email: string | null; tax_id: string | null; notes: string | null; is_active: boolean; contactsCount: number }
export interface Place { address: string; label?: string; lat: number; lng: number }
export interface PlaceSuggestion { placeId: string; description: string; mainText: string; secondaryText: string }
export interface PlaceDetails { placeId: string; name: string; address: string; lat: number; lng: number }
export type ServiceType = 'airport_pickup' | 'airport_dropoff' | 'point_to_point' | 'hourly' | 'full_day';
export type VehicleClass = 'eco' | 'business' | 'first' | 'exotic' | 'suv' | 'van' | 'luxury_bus';
export type ChildSeatType = 'front_facing' | 'rear_facing' | 'infant' | 'booster';
export interface ChildSeat { type: ChildSeatType; quantity: number }
export interface FlightTracking {
  provider?: string | null;
  flight_iata?: string | null;
  status?: string | null;
  airport_code?: string | null;
  airport_name?: string | null;
  airline_name?: string | null;
  scheduled_at?: string | null;
  estimated_at?: string | null;
  actual_at?: string | null;
  terminal?: string | null;
  gate?: string | null;
  delay_minutes?: number | null;
  checked_at?: string | null;
}

export interface Booking {
  id: string;
  externalId?: string | null;
  driverId: number | null;
  driverName: string;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  pickup: { address: string; label: string; location: { lat: number; lng: number } };
  drop: { address: string; label: string; location: { lat: number; lng: number } };
  fare: number;
  distanceKm: number;
  durationMin: number;
  bookingType: string | null;
  serviceType: ServiceType;
  assignmentStatus: 'unassigned' | 'assigned' | 'accepted' | 'rejected';
  financialDisposition: 'standard' | 'cancelled_non_chargeable' | 'no_show_chargeable';
  vehicleClass: VehicleClass | null;
  bookingLabel: string | null;
  bookingNotes: string | null;
  partnerId: number | null;
  accountId: number | null;
  partnerName: string | null;
  scheduledAt: string | null;
  rentalDurationHours: number | null;
  rentalEndAt: string | null;
  startedAt?: number | null;
  endedAt?: number | null;
  guestCount: number | null;
  luggageCount: number;
  childSeats: ChildSeat[];
  stops: Array<{ address: string; label?: string; lat?: number; lng?: number; location?: { lat: number; lng: number } }>;
  roomNo: string | null;
  flightNo: string | null;
  airportCode: string | null;
  flightAirlineCode: string | null;
  flightNumber: string | null;
  flightTracking: FlightTracking | null;
}

export interface Payment {
  id: number;
  tripId: number;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  paymentLink: string;
  trackingId: string | null;
  bankRefNo: string | null;
  paymentMode: string | null;
  failureMessage: string | null;
  linkCreatedAt: string;
  paidAt: string | null;
  expiresAt: string | null;
}

export interface Invoice { id: number; tripId: number; invoiceNo: string; status: string; amount: number; paidAmount: number; amountDue: number; currency: string; issueDate: string | null; dueDate: string | null; paidAt: string | null; lineItems: Array<Record<string, unknown>> }
export interface BookingTransaction { id: number; eventType: string; status: string; amount: number; currency: string; description: string; actorUserId: number | null; actorName: string | null; actorEmail: string | null; referenceType: string | null; referenceId: string | null; metadata: Record<string, unknown>; createdAt: string }
export interface FinanceTotals { charged: number; paid: number; outstanding: number; currency: string }
export interface TripFinance { tripId: number; payment: Payment | null; payments: Payment[]; invoice: Invoice | null; transactions: BookingTransaction[]; totals: FinanceTotals }
export type AdjustmentCategory = 'salik' | 'parking' | 'airport_fee' | 'waiting_time' | 'extra_stop' | 'gratuity' | 'damage_cleaning' | 'discount' | 'other';

export interface BookingPayload {
  driver_id: number | null;
  vehicle_id: number | null;
  partner_id?: number | null;
  account_id?: number | null;
  booking_type: string;
  service_type: ServiceType;
  vehicle_class?: VehicleClass | null;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string | null;
  airport_code?: string | null;
  flight_airline_code?: string | null;
  flight_number?: string | null;
  flight_no?: string | null;
  pickup: Place;
  dropoff: Place;
  stops?: Place[];
  scheduled_at: string;
  guest_count?: number | null;
  luggage_count?: number;
  child_seats?: ChildSeat[];
  fare?: number | null;
  distance_km?: number | null;
  duration_min?: number | null;
  rental_duration_hours?: number | null;
  notes?: string | null;
  notify_driver?: boolean;
}

const API = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') || (import.meta.env.PROD ? 'https://dcmjewqvn2xdz.cloudfront.net' : 'http://127.0.0.1:8000');
const TOKEN_KEY = 'zpl_token';
const USER_KEY = 'zpl_user';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = await response.json() as { detail?: unknown };
      message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || message);
    } catch { /* use fallback */ }
    if (response.status === 401) clearSession();
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

function token(): string { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
function query(values: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') p.set(key, String(value)); });
  return p.size ? `?${p}` : '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  return parse<T>(response);
}

async function blob(path: string): Promise<Blob> {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!response.ok) throw new ApiError('Could not download file', response.status);
  return response.blob();
}

export function saveSession(accessToken: string, user: User, remember: boolean): void {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, accessToken);
  store.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem('zpl_remember_device', remember ? '1' : '0');
}
export function clearSession(): void { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); }
export function storedUser(): User | null { try { return JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null') as User | null; } catch { return null; } }
export function hasToken(): boolean { return Boolean(token()); }

export async function login(email: string, password: string): Promise<string> {
  const result = await parse<{ access_token: string }>(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }));
  return result.access_token;
}
export function me(): Promise<User> { return request('/auth/me'); }
export function listDrivers(): Promise<Paginated<Driver>> { return request('/dashboard/drivers?page=1&page_size=200&is_active=true'); }
export function listVehicles(): Promise<Paginated<Vehicle>> { return request('/dashboard/vehicles?page=1&page_size=200&is_active=true'); }
export function listPartners(activeOnly = true): Promise<Paginated<Partner>> { return request(`/dashboard/booking-partners?page=1&page_size=200${activeOnly ? '&is_active=true' : ''}`); }
export function createPartner(payload: Omit<Partner, 'id' | 'contactsCount'>): Promise<Partner> { return request('/dashboard/booking-partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
export function updatePartner(id: number, payload: Omit<Partner, 'id' | 'contactsCount'>): Promise<Partner> { return request(`/dashboard/booking-partners/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }

export function listBookings(values: { page?: number; pageSize?: number; q?: string; status?: string; createdByMe?: boolean } = {}): Promise<Paginated<Booking>> {
  return request(`/dashboard/bookings${query({ page: values.page || 1, page_size: values.pageSize || 100, q: values.q, status: values.status, created_by_me: values.createdByMe })}`);
}
export function createBooking(payload: BookingPayload): Promise<Booking> { return request('/dashboard/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
export function updateBooking(id: number | string, payload: Record<string, unknown>): Promise<Booking> { return request(`/dashboard/bookings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
export function notifyDriver(id: number | string): Promise<{ sent: boolean; reason: string | null }> { return request(`/dashboard/bookings/${id}/notify`, { method: 'POST' }); }
export function refreshBookingFlight(id: number | string): Promise<Booking> { return request(`/dashboard/bookings/${id}/flight/refresh`, { method: 'POST' }); }

export function searchPlaces(text: string, sessionToken: string): Promise<PlaceSuggestion[]> { return request(`/dashboard/bookings/places${query({ q: text, session_token: sessionToken })}`); }
export function placeDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> { return request(`/dashboard/bookings/place-details${query({ place_id: placeId, session_token: sessionToken })}`); }
export function estimateRoute(payload: { pickup: Place; dropoff: Place; stops?: Place[]; vehicle_id?: number | null; scheduled_at: string }): Promise<{ fare: number; distanceKm: number; durationMin: number }> { return request('/dashboard/bookings/fare-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }

export function finance(tripIds: Array<string | number>): Promise<TripFinance[]> { return request(`/booking-operations/finance${query({ trip_ids: tripIds.join(',') })}`); }
export function createPaymentLink(tripId: number | string, amount?: number): Promise<Payment> { return request(`/booking-operations/bookings/${tripId}/payment-links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amount || undefined, currency: 'AED', createInvoice: true }) }); }
export function extendRental(tripId: number | string, payload: { additionalHours: number; amount: number; notes?: string; createPaymentLink: boolean }): Promise<{ rentalDurationHours: number; rentalEndAt: string; payment: Payment | null; finance: TripFinance }> { return request(`/booking-operations/bookings/${tripId}/rental-extensions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
export function addInvoiceAdjustment(tripId: number | string, payload: { category: AdjustmentCategory; amount: number; reason: string; createPaymentLink: boolean }): Promise<{ transaction: BookingTransaction; payment: Payment | null; finance: TripFinance }> { return request(`/booking-operations/bookings/${tripId}/adjustments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
export function refreshPayment(paymentId: number): Promise<Payment> { return request(`/booking-operations/payments/${paymentId}/refresh`, { method: 'POST' }); }
export async function downloadInvoice(invoiceId: number, filename: string): Promise<void> { const value = await blob(`/booking-operations/invoices/${invoiceId}/pdf`); const url = URL.createObjectURL(value); const a = document.createElement('a'); a.href = url; a.download = `${filename}.pdf`; a.click(); URL.revokeObjectURL(url); }
export function shareInvoice(invoiceId: number): Promise<{ url: string }> { return request(`/booking-operations/invoices/${invoiceId}/share`, { method: 'POST' }); }
