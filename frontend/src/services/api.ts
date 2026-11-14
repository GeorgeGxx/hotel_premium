import {
  Room,
  RoomStatus,
  StayDetails,
  CreateStayDTO,
  UpdateStayDTO,
  StayStatus,
  PaymentStatus,
  ConciergeAddon,
  StayCharge,
  AddStayChargeDTO,
} from '../types/hotel';
import { getValidAccessToken, getActiveSessionRole } from './auth';

const rawApiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const API_BASE = rawApiBase === '/api' ? '/api/v1' : rawApiBase;
const DEFAULT_TIMEOUT_MS = 10000;

export class ApiError extends Error {
  public readonly status: number;
  public readonly correlationId: string;

  constructor(message: string, status = 500, correlationId = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.correlationId = correlationId;
  }
}

let demoMockOverride: boolean | null = null;

/**
 * Allows explicit toggling of offline demo mock fallback in development or unit tests.
 * In production builds (MODE === 'production'), demo mocks are disabled unless VITE_ENABLE_DEMO_MOCKS === 'true'.
 */
export function setDemoMockMode(enabled: boolean | null): void {
  demoMockOverride = enabled;
}

export function isDemoMockEnabled(): boolean {
  if (demoMockOverride !== null) {
    return demoMockOverride;
  }
  return import.meta.env.VITE_ENABLE_DEMO_MOCKS === 'true' || import.meta.env.MODE === 'test';
}

function generateIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function buildRequestHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const correlationId = generateIdempotencyKey('corr');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Correlation-ID': correlationId,
    ...extraHeaders,
  };

  const token = await getValidAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (import.meta.env.MODE !== 'production') {
    headers['X-User-Role'] = extraHeaders['X-User-Role'] || getActiveSessionRole();
  }

  return headers;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(url, {
      ...options,
      signal: controller ? controller.signal : undefined,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const mockRooms: Room[] = [
  {
    id: '1a7e2b10-0001-4000-8000-000000000001',
    number: '101',
    category_id: 'cat-1',
    category_name: 'Single Standard',
    floor: 1,
    status: 'AVAILABLE',
    base_price: 65.0,
    capacity: 1,
    rating: 4.8,
    review_count: 42,
    size_sqft: 280,
    bed_type: '1 Queen Bed',
    view_type: 'City Courtyard View',
    image_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80',
    amenities: ['High-speed Wi-Fi 7', 'Rainfall Shower', 'Smart 4K TV', 'Ergonomic Desk'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '1a7e2b10-0002-4000-8000-000000000002',
    number: '102',
    category_id: 'cat-2',
    category_name: 'Double Deluxe',
    floor: 1,
    status: 'OCCUPIED',
    base_price: 95.0,
    capacity: 2,
    rating: 4.9,
    review_count: 88,
    size_sqft: 420,
    bed_type: '1 King Bed',
    view_type: 'Oceanfront Terrace',
    image_url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
    amenities: ['Private Ocean Balcony', 'Nespresso Coffee Bar', 'Italian Marble Bath', 'Curated Minibar'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '1a7e2b10-0003-4000-8000-000000000003',
    number: '201',
    category_id: 'cat-2',
    category_name: 'Double Deluxe',
    floor: 2,
    status: 'DIRTY',
    base_price: 95.0,
    capacity: 2,
    rating: 4.7,
    review_count: 65,
    size_sqft: 420,
    bed_type: '2 Queen Beds',
    view_type: 'Poolside Botanical Garden',
    image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
    amenities: ['Garden Patio', 'Complimentary Afternoon Tea', 'Plush Bathrobes', 'Acoustic Soundproofing'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '1a7e2b10-0004-4000-8000-000000000004',
    number: '202',
    category_id: 'cat-3',
    category_name: 'Presidential Suite',
    floor: 2,
    status: 'AVAILABLE',
    base_price: 220.0,
    capacity: 4,
    rating: 5.0,
    review_count: 112,
    size_sqft: 850,
    bed_type: 'Master King + 2 Doubles',
    view_type: 'Panoramic Skyline Penthouse',
    image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    amenities: ['Private Heated Jacuzzi', '24/7 Dedicated Butler', 'Private Cocktail Lounge', 'Executive Club Access'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '1a7e2b10-0005-4000-8000-000000000005',
    number: '301',
    category_id: 'cat-2',
    category_name: 'Double Deluxe',
    floor: 3,
    status: 'MAINTENANCE',
    base_price: 95.0,
    capacity: 2,
    rating: 4.8,
    review_count: 73,
    size_sqft: 420,
    bed_type: '1 King Bed',
    view_type: 'Golden Hour Sunset View',
    image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
    amenities: ['Sunset Balcony', 'Smart Climate Control', 'Hypoallergenic Bedding', 'Dyson Supersonic Care'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '1a7e2b10-0006-4000-8000-000000000006',
    number: '302',
    category_id: 'cat-3',
    category_name: 'Presidential Suite',
    floor: 3,
    status: 'OCCUPIED',
    base_price: 220.0,
    capacity: 4,
    rating: 5.0,
    review_count: 140,
    size_sqft: 900,
    bed_type: 'Grand King Bed',
    view_type: 'VIP Ocean Panorama Corner',
    image_url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
    amenities: ['Private Spa Hydro-Pool', 'Private Sommelier Wine Cellar', 'Bang & Olufsen Acoustics', 'VIP Helipad Transfer Service'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export function getRoomImageUrl(room: Partial<Room>): string {
  if (room.image_url && room.image_url.trim() !== '') {
    return room.image_url;
  }
  const category = (room.category_name || '').toLowerCase();
  const num = room.number || '';
  if (category.includes('presidential') || category.includes('suite') || num === '202' || num === '302') {
    return 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80';
  }
  if (category.includes('deluxe') || num === '102' || num === '201' || num === '301') {
    return 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80';
  }
  return 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80';
}

export const CONCIERGE_ADDONS: ConciergeAddon[] = [
  {
    id: 'addon-vip-transfer',
    name: 'VIP Airport Limousine Transfer (Mercedes S-Class)',
    description: 'Private airport arrival meet & greet with luggage assistance.',
    priceUSD: 95.0,
  },
  {
    id: 'addon-champagne',
    name: 'Chilled Moët & Chandon Champagne & Artisan Truffles',
    description: 'Prestigious chilled bottle waiting in your suite upon check-in.',
    priceUSD: 120.0,
  },
  {
    id: 'addon-spa',
    name: 'Nordic Spa & Couples Aromatherapy Massage (60 min)',
    description: 'Private botanical sauna session and certified therapist treatment.',
    priceUSD: 150.0,
  },
  {
    id: 'addon-breakfast',
    name: 'Daily Gourmet Executive Breakfast Buffet',
    description: 'Artisanal organic buffet, freshly squeezed juices and specialty barista coffee.',
    priceUSD: 45.0,
    perGuest: true,
  },
];

let mockStaysMemory: StayDetails[] = [
  {
    id: 'stay-0001-mock',
    room_id: '1a7e2b10-0002-4000-8000-000000000002',
    primary_guest_id: 'guest-001',
    room_number: '102',
    category_name: 'Double Deluxe',
    room_floor: 1,
    guest_name: 'Lord Arthur Sterling',
    guest_email: 'sterling@royalresidences.co.uk',
    guest_phone: '+44 20 7946 0912',
    document_type: 'PASSPORT',
    document_number: 'GB98273641',
    check_in_date: new Date(Date.now() - 86400000).toISOString(),
    check_out_date: new Date(Date.now() + 2 * 86400000).toISOString(),
    status: 'ACTIVE',
    nightly_rate: 95.0,
    total_nights: 3,
    deposit_amount: 285.0,
    total_amount: 285.0,
    payment_status: 'PAID',
    notes: 'Requires daily sparkling water and late departure.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'stay-0002-mock',
    room_id: '1a7e2b10-0006-4000-8000-000000000006',
    primary_guest_id: 'guest-002',
    room_number: '302',
    category_name: 'Presidential Suite',
    room_floor: 3,
    guest_name: 'Elena Rostova',
    guest_email: 'elena.rostova@genevafunds.ch',
    guest_phone: '+41 22 555 0199',
    document_type: 'PASSPORT',
    document_number: 'CH8812940',
    check_in_date: new Date().toISOString(),
    check_out_date: new Date(Date.now() + 5 * 86400000).toISOString(),
    status: 'ACTIVE',
    nightly_rate: 220.0,
    total_nights: 5,
    deposit_amount: 1100.0,
    total_amount: 1100.0,
    payment_status: 'PAID',
    notes: 'VIP guest. Helipad pickup requested.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'stay-0003-mock',
    room_id: '1a7e2b10-0004-4000-8000-000000000004',
    primary_guest_id: 'guest-003',
    room_number: '202',
    category_name: 'Presidential Suite',
    room_floor: 2,
    guest_name: 'Marcus Vance',
    guest_email: 'm.vance@techhorizon.io',
    guest_phone: '+1 415 555 2671',
    document_type: 'DRIVERS_LICENSE',
    document_number: 'CA-D998124',
    check_in_date: new Date(Date.now() + 2 * 86400000).toISOString(),
    check_out_date: new Date(Date.now() + 6 * 86400000).toISOString(),
    status: 'RESERVED',
    nightly_rate: 220.0,
    total_nights: 4,
    deposit_amount: 440.0,
    total_amount: 880.0,
    payment_status: 'PARTIAL',
    notes: 'Early check-in requested at 11:00 AM.',
    created_at: new Date().toISOString(),
  },
];

/* =========================================================================
   ROOMS API
   ========================================================================= */

let activeRoomsMemory: Room[] = [...mockRooms];

export async function fetchRooms(): Promise<Room[]> {
  try {
    const headers = await buildRequestHeaders();
    const res = await fetchWithTimeout(`${API_BASE}/rooms`, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || `Failed to fetch rooms (HTTP ${res.status})`, res.status);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      if (data.length === 0 && isDemoMockEnabled()) {
        return mockRooms;
      }
      activeRoomsMemory = data;
      return data;
    }
    return isDemoMockEnabled() ? mockRooms : [];
  } catch (err) {
    if (isDemoMockEnabled()) {
      return mockRooms;
    }
    throw err instanceof Error ? err : new ApiError('Failed to fetch rooms');
  }
}

export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  try {
    const headers = await buildRequestHeaders({
      'Content-Type': 'application/json',
    });
    const res = await fetchWithTimeout(`${API_BASE}/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to update room status on backend', res.status);
    }
  } catch (err) {
    if (!isDemoMockEnabled()) {
      throw err instanceof Error ? err : new ApiError('Failed to update room status');
    }
  }
}

export async function updateRoomPrice(roomId: string, price: number): Promise<void> {
  try {
    const headers = await buildRequestHeaders({
      'Content-Type': 'application/json',
      'X-User-Role': 'ADMIN',
    });
    const res = await fetchWithTimeout(`${API_BASE}/rooms/${roomId}/price`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ price }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to update room rate on backend', res.status);
    }
  } catch (err) {
    if (!isDemoMockEnabled()) {
      throw err instanceof Error ? err : new ApiError('Failed to update room price');
    }
  }
}

/* =========================================================================
   RESERVATIONS & STAYS API (GET, POST, PUT, DELETE, PATCH)
   ========================================================================= */

export async function fetchStays(status?: StayStatus): Promise<StayDetails[]> {
  try {
    const url = status ? `${API_BASE}/stays?status=${status}` : `${API_BASE}/stays`;
    const headers = await buildRequestHeaders();
    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to fetch stays from backend', res.status);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      if (data.length === 0 && isDemoMockEnabled()) {
        return status ? mockStaysMemory.filter((s) => s.status === status) : mockStaysMemory;
      }
      return data;
    }
    return isDemoMockEnabled()
      ? status
        ? mockStaysMemory.filter((s) => s.status === status)
        : mockStaysMemory
      : [];
  } catch (err) {
    if (isDemoMockEnabled()) {
      return status ? mockStaysMemory.filter((s) => s.status === status) : mockStaysMemory;
    }
    throw err instanceof Error ? err : new ApiError('Failed to fetch stays');
  }
}

export async function createStay(dto: CreateStayDTO): Promise<StayDetails> {
  try {
    const headers = await buildRequestHeaders({
      'Content-Type': 'application/json',
      'Idempotency-Key': generateIdempotencyKey('stay-create'),
    });
    const res = await fetchWithTimeout(`${API_BASE}/stays`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Room is already booked for this period.', 409);
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to create reservation', res.status);
    }
    return res.json();
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      throw err;
    }
    if (err instanceof Error && err.message.includes('already booked')) {
      throw err;
    }
    if (!isDemoMockEnabled()) {
      throw err instanceof Error ? err : new ApiError('Failed to create reservation');
    }

    // Explicit demo/test mode simulation only
    const roomInfo =
      activeRoomsMemory.find((r) => r.id === dto.room_id) ||
      mockRooms.find((r) => r.id === dto.room_id);
    const totalAmount = Math.round(dto.total_nights * dto.nightly_rate * 100) / 100;
    const paymentStatus: PaymentStatus =
      dto.deposit_amount >= totalAmount
        ? 'PAID'
        : dto.deposit_amount > 0
        ? 'PARTIAL'
        : 'PENDING';

    const newMockStay: StayDetails = {
      id: `stay-${Date.now()}`,
      room_id: dto.room_id,
      primary_guest_id: `guest-${Date.now()}`,
      room_number: roomInfo?.number || '101',
      category_name: roomInfo?.category_name || 'Standard',
      room_floor: roomInfo?.floor || 1,
      guest_name: dto.guest_name,
      guest_email: dto.guest_email,
      guest_phone: dto.guest_phone,
      document_type: dto.document_type || 'PASSPORT',
      document_number: dto.document_number || 'SIM-999',
      check_in_date: dto.check_in_date,
      check_out_date: dto.check_out_date,
      status: dto.status || 'RESERVED',
      nightly_rate: dto.nightly_rate,
      total_nights: dto.total_nights,
      deposit_amount: dto.deposit_amount,
      total_amount: totalAmount,
      payment_status: paymentStatus,
      notes: dto.notes,
      created_at: new Date().toISOString(),
    };
    mockStaysMemory = [newMockStay, ...mockStaysMemory];
    return newMockStay;
  }
}

export async function updateStay(stayId: string, dto: UpdateStayDTO): Promise<StayDetails> {
  try {
    const headers = await buildRequestHeaders({
      'Content-Type': 'application/json',
    });
    const res = await fetchWithTimeout(`${API_BASE}/stays/${stayId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(dto),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Conflict: Room is booked for these dates.', 409);
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to update reservation', res.status);
    }
    return res.json();
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      throw err;
    }
    if (err instanceof Error && err.message.includes('Conflict')) {
      throw err;
    }
    if (!isDemoMockEnabled()) {
      throw err instanceof Error ? err : new ApiError('Failed to update reservation');
    }

    mockStaysMemory = mockStaysMemory.map((s) => {
      if (s.id !== stayId) return s;
      const updatedTotalNights = dto.total_nights ?? s.total_nights;
      const updatedRate = dto.nightly_rate ?? s.nightly_rate;
      const updatedDeposit = dto.deposit_amount ?? s.deposit_amount;
      const updatedTotal = Math.round(updatedTotalNights * updatedRate * 100) / 100;
      return {
        ...s,
        check_in_date: dto.check_in_date ?? s.check_in_date,
        check_out_date: dto.check_out_date ?? s.check_out_date,
        total_nights: updatedTotalNights,
        nightly_rate: updatedRate,
        deposit_amount: updatedDeposit,
        total_amount: updatedTotal,
        payment_status: updatedDeposit >= updatedTotal ? 'PAID' : updatedDeposit > 0 ? 'PARTIAL' : 'PENDING',
        notes: dto.notes ?? s.notes,
      };
    });
    const found = mockStaysMemory.find((s) => s.id === stayId);
    if (found) return found;
    throw err;
  }
}

export async function cancelStay(stayId: string): Promise<void> {
  try {
    const headers = await buildRequestHeaders();
    const res = await fetchWithTimeout(`${API_BASE}/stays/${stayId}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to cancel reservation on server', res.status);
    }
  } catch (err) {
    if (!isDemoMockEnabled()) {
      throw err instanceof Error ? err : new ApiError('Failed to cancel reservation');
    }
  } finally {
    if (isDemoMockEnabled()) {
      mockStaysMemory = mockStaysMemory.map((s) =>
        s.id === stayId ? { ...s, status: 'CANCELLED' } : s
      );
    }
  }
}

export async function checkOutStay(
  stayId: string,
  settlement?: { deposit_amount?: number; payment_status?: PaymentStatus; notes?: string }
): Promise<void> {
  try {
    const headers = await buildRequestHeaders(
      settlement ? { 'Content-Type': 'application/json' } : {}
    );
    const res = await fetchWithTimeout(`${API_BASE}/stays/${stayId}/check-out`, {
      method: 'POST',
      headers,
      body: settlement ? JSON.stringify(settlement) : undefined,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to complete check-out on server', res.status);
    }
  } catch (err) {
    if (!isDemoMockEnabled()) {
      throw err instanceof Error ? err : new ApiError('Failed to complete check-out');
    }
  } finally {
    if (isDemoMockEnabled()) {
      mockStaysMemory = mockStaysMemory.map((s) =>
        s.id === stayId ? { ...s, status: 'CHECKED_OUT' } : s
      );
    }
  }
}

// ==============================================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) & SAGA INTEGRATION
// ==============================================================================

export function subscribeToLiveEvents(
  onEvent: (eventType: string, data: any) => void
): () => void {
  try {
    const sseUrl = `${API_BASE}/events/live`;
    const eventSource = new EventSource(sseUrl);

    const supportedEvents = [
      'room_updated',
      'room_price_updated',
      'stay_created',
      'stay_updated',
      'stay_cancelled',
      'stay_checked_out',
    ];

    for (const evtName of supportedEvents) {
      eventSource.addEventListener(evtName, (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          onEvent(evtName, payload);
        } catch (err) {
          console.error(`Failed to parse ${evtName} SSE:`, err);
        }
      });
    }

    eventSource.onerror = () => {
      // Browser EventSource handles automatic exponential reconnection
    };

    return () => {
      eventSource.close();
    };
  } catch {
    return () => {};
  }
}

// ==============================================================================
// FOLIO ADD-ON CHARGES & POS INTEGRATION
// ==============================================================================

let mockChargesMemory: StayCharge[] = [
  {
    id: 'chg-001',
    stay_id: 'stay-002',
    description: 'Sommelier Wine & Artisanal Cheese Selection',
    quantity: 1,
    unit_price: 68.0,
    total_price: 68.0,
    created_at: new Date(Date.now() - 3600000 * 14).toISOString(),
  },
  {
    id: 'chg-002',
    stay_id: 'stay-002',
    description: 'Hydrotherapy & Deep Tissue Spa Session',
    quantity: 1,
    unit_price: 120.0,
    total_price: 120.0,
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
];

export async function fetchStayCharges(stayId: string): Promise<StayCharge[]> {
  try {
    const headers = await buildRequestHeaders();
    const res = await fetchWithTimeout(`${API_BASE}/billing/stays/${stayId}/charges`, {
      headers,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to fetch stay charges', res.status);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      if (data.length === 0 && isDemoMockEnabled()) {
        return mockChargesMemory.filter((c) => c.stay_id === stayId);
      }
      return data;
    }
    return [];
  } catch (err) {
    if (isDemoMockEnabled()) {
      return mockChargesMemory.filter((c) => c.stay_id === stayId);
    }
    throw err instanceof Error ? err : new ApiError('Failed to fetch stay charges');
  }
}

export async function addStayCharge(dto: AddStayChargeDTO): Promise<StayCharge> {
  try {
    const headers = await buildRequestHeaders({
      'Content-Type': 'application/json',
      'X-Idempotency-Key': generateIdempotencyKey('idem-chg'),
    });
    const res = await fetchWithTimeout(`${API_BASE}/billing/charges`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new ApiError(errData.error || 'Failed to post folio charge', res.status);
    }
    const serverCharge = await res.json();
    if (isDemoMockEnabled()) {
      mockChargesMemory.push(serverCharge);
    }
    return serverCharge;
  } catch (err) {
    if (!isDemoMockEnabled()) {
      throw err instanceof Error ? err : new ApiError('Failed to post folio charge');
    }
    const qty = dto.quantity || 1;
    const newCharge: StayCharge = {
      id: generateIdempotencyKey('chg'),
      stay_id: dto.stay_id,
      product_id: dto.product_id,
      description: dto.description,
      quantity: qty,
      unit_price: dto.unit_price,
      total_price: Math.round(qty * dto.unit_price * 100) / 100,
      created_at: new Date().toISOString(),
    };
    mockChargesMemory.push(newCharge);
    return newCharge;
  }
}
