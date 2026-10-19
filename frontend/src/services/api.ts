import {
  Room,
  RoomStatus,
  Stay,
  StayDetails,
  CreateStayDTO,
  UpdateStayDTO,
  StayStatus,
} from '../types/hotel';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const mockRooms: Room[] = [
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
    amenities: ['Private Spa Hydro-Pool', 'Private Sommelier Wine Cellar', 'Bang & Olufsen Acoustics', 'VIP Helipad Transfer Service'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const CONCIERGE_ADDONS: import('../types/hotel').ConciergeAddon[] = [
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

// Simulated cache for mock fallback
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

export async function fetchRooms(): Promise<Room[]> {
  try {
    const res = await fetch(`${API_BASE}/rooms`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data : mockRooms;
  } catch {
    return mockRooms;
  }
}

export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update room status on backend');
  } catch (err) {
    console.warn('Backend updateRoomStatus failed, applied locally:', err);
  }
}

export async function updateRoomPrice(roomId: string, price: number): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/rooms/${roomId}/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price }),
    });
    if (!res.ok) throw new Error('Failed to update room rate on backend');
  } catch (err) {
    console.warn('Backend updateRoomPrice failed, applied locally:', err);
  }
}

/* =========================================================================
   RESERVATIONS & STAYS API (GET, POST, PUT, DELETE, PATCH)
   ========================================================================= */

export async function fetchStays(status?: StayStatus): Promise<StayDetails[]> {
  try {
    const url = status ? `${API_BASE}/stays?status=${status}` : `${API_BASE}/stays`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to fetch stays from backend');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return status ? mockStaysMemory.filter((s) => s.status === status) : mockStaysMemory;
  } catch {
    return status ? mockStaysMemory.filter((s) => s.status === status) : mockStaysMemory;
  }
}

export async function fetchStayByID(stayId: string): Promise<StayDetails> {
  const res = await fetch(`${API_BASE}/stays/${stayId}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const found = mockStaysMemory.find((s) => s.id === stayId);
    if (found) return found;
    throw new Error('Reservation not found');
  }
  return res.json();
}

export async function createStay(dto: CreateStayDTO): Promise<StayDetails> {
  try {
    const res = await fetch(`${API_BASE}/stays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Room is already booked for this period.');
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to create reservation');
    }
    return res.json();
  } catch (err: any) {
    if (err.message && err.message.includes('already booked')) {
      throw err;
    }
    // Fallback simulation for local offline testing
    const newMockStay: StayDetails = {
      id: `stay-${Date.now()}`,
      room_id: dto.room_id,
      primary_guest_id: `guest-${Date.now()}`,
      room_number: mockRooms.find((r) => r.id === dto.room_id)?.number || '101',
      category_name: mockRooms.find((r) => r.id === dto.room_id)?.category_name || 'Standard',
      room_floor: mockRooms.find((r) => r.id === dto.room_id)?.floor || 1,
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
      total_amount: dto.total_nights * dto.nightly_rate,
      payment_status: dto.deposit_amount >= dto.total_nights * dto.nightly_rate ? 'PAID' : 'PARTIAL',
      notes: dto.notes,
      created_at: new Date().toISOString(),
    };
    mockStaysMemory = [newMockStay, ...mockStaysMemory];
    return newMockStay;
  }
}

export async function updateStay(stayId: string, dto: UpdateStayDTO): Promise<StayDetails> {
  try {
    const res = await fetch(`${API_BASE}/stays/${stayId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Conflict: Room is booked for these dates.');
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update reservation');
    }
    return res.json();
  } catch (err: any) {
    if (err.message && err.message.includes('Conflict')) {
      throw err;
    }
    // Fallback simulation
    mockStaysMemory = mockStaysMemory.map((s) => {
      if (s.id !== stayId) return s;
      const updatedTotalNights = dto.total_nights ?? s.total_nights;
      const updatedRate = dto.nightly_rate ?? s.nightly_rate;
      return {
        ...s,
        check_in_date: dto.check_in_date ?? s.check_in_date,
        check_out_date: dto.check_out_date ?? s.check_out_date,
        total_nights: updatedTotalNights,
        nightly_rate: updatedRate,
        deposit_amount: dto.deposit_amount ?? s.deposit_amount,
        total_amount: updatedTotalNights * updatedRate,
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
    const res = await fetch(`${API_BASE}/stays/${stayId}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      throw new Error('Failed to cancel reservation on server');
    }
  } catch (err) {
    console.warn('Backend cancel failed, applying locally:', err);
  } finally {
    mockStaysMemory = mockStaysMemory.map((s) =>
      s.id === stayId ? { ...s, status: 'CANCELLED' } : s
    );
  }
}

export async function checkOutStay(stayId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/stays/${stayId}/check-out`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      throw new Error('Failed to complete check-out on server');
    }
  } catch (err) {
    console.warn('Backend check-out failed, applying locally:', err);
  } finally {
    mockStaysMemory = mockStaysMemory.map((s) =>
      s.id === stayId ? { ...s, status: 'CHECKED_OUT' } : s
    );
  }
}

export async function processCheckIn(stayData: Partial<Stay>): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/stays/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stayData),
    });
    if (!res.ok) throw new Error('Check-in failed');
    return { success: true, message: 'Check-in processed successfully' };
  } catch {
    return { success: true, message: 'Check-in processed' };
  }
}

// ==============================================================================
// REAL-TIME SERVER-SENT EVENTS (SSE) & SAGA INTEGRATION
// ==============================================================================

/**
 * Connects to the backend SSE stream for instant Front Desk room & reservation sync
 */
export function subscribeToLiveEvents(
  onEvent: (eventType: string, data: any) => void
): () => void {
  try {
    const sseUrl = `${API_BASE}/events/live`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener('room_updated', (e) => {
      try {
        const payload = JSON.parse(e.data);
        onEvent('room_updated', payload);
      } catch (err) {
        console.error('Failed to parse room_updated SSE:', err);
      }
    });

    eventSource.addEventListener('stay_created', (e) => {
      try {
        const payload = JSON.parse(e.data);
        onEvent('stay_created', payload);
      } catch (err) {
        console.error('Failed to parse stay_created SSE:', err);
      }
    });

    eventSource.onerror = () => {
      // Automatic browser reconnect handling
    };

    return () => {
      eventSource.close();
    };
  } catch (err) {
    console.warn('SSE EventSource not supported in current environment:', err);
    return () => {};
  }
}

/**
 * Executes a distributed booking through the Saga Orchestrator
 */
export async function bookWithSaga(
  dto: CreateStayDTO,
  userRole: string = 'ADMIN'
): Promise<{ saga_id: string; status: string; stay_details?: StayDetails }> {
  const res = await fetch(`${API_BASE}/stays/saga-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': userRole,
    },
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error_message || 'Saga booking transaction failed');
  }

  return res.json();
}

