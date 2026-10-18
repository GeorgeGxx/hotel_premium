export type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'BLOCKED';

export interface Room {
  id: string;
  number: string;
  category_id: string;
  category_name: string;
  floor: number;
  status: RoomStatus;
  base_price: number;
  capacity: number;
  notes?: string;
  rating?: number;
  review_count?: number;
  size_sqft?: number;
  bed_type?: string;
  image_url?: string;
  amenities?: string[];
  view_type?: string;
  created_at: string;
  updated_at: string;
}

export interface ConciergeAddon {
  id: string;
  name: string;
  description: string;
  priceUSD: number;
  perGuest?: boolean;
}

export interface GuestBookingRequest {
  roomId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  adultsCount: number;
  childrenCount: number;
  selectedAddonIds: string[];
  specialRequests?: string;
  totalNights: number;
  roomSubtotalUSD: number;
  addonsSubtotalUSD: number;
  taxesUSD: number;
  grandTotalUSD: number;
}

export type StayStatus = 'RESERVED' | 'ACTIVE' | 'CHECKED_OUT' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED';

export interface Stay {
  id: string;
  room_id: string;
  primary_guest_id: string;
  guest_name?: string;
  check_in_date: string;
  check_out_date: string;
  status: StayStatus;
  nightly_rate: number;
  total_nights: number;
  deposit_amount: number;
  total_amount: number;
  payment_status: PaymentStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StayDetails extends Stay {
  room_number: string;
  category_name: string;
  room_floor: number;
  guest_email?: string;
  guest_phone?: string;
  document_type?: string;
  document_number?: string;
}

export interface CreateStayDTO {
  room_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  document_type?: string;
  document_number?: string;
  check_in_date: string;
  check_out_date: string;
  total_nights: number;
  nightly_rate: number;
  deposit_amount: number;
  notes?: string;
  status?: StayStatus;
}

export interface UpdateStayDTO {
  check_in_date?: string;
  check_out_date?: string;
  total_nights?: number;
  nightly_rate?: number;
  deposit_amount?: number;
  notes?: string;
}

export interface CashShift {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at?: string;
  opening_amount: number;
  closing_amount?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface CheckInFormData {
  roomId: string;
  guestName: string;
  documentType: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE';
  documentNumber: string;
  email: string;
  phone: string;
  nights: number;
  nightlyRate: number;
  deposit: number;
  notes: string;
}

export type UserRole = 'ADMIN' | 'USER';

export interface CurrentUser {
  username: string;
  fullName: string;
  role: UserRole;
  email: string;
}
