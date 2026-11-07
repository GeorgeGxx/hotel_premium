import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReservationsManager } from './ReservationsManager';
import { StayDetails, Room, CurrentUser } from '../types/hotel';

describe('ReservationsManager Component Tests', () => {
  const mockUser: CurrentUser = {
    username: 'test_admin',
    email: 'admin@hotelpremium.com',
    role: 'ADMIN',
    fullName: 'Administrator',
  };

  const mockRooms: Room[] = [
    {
      id: 'room-1',
      number: '101',
      category_id: 'cat-1',
      category_name: 'Single Standard',
      floor: 1,
      status: 'AVAILABLE',
      base_price: 65,
      capacity: 1,
      rating: 4.8,
      review_count: 50,
      size_sqft: 320,
      bed_type: 'Queen',
      view_type: 'Garden',
      amenities: ['Wi-Fi'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockStays: StayDetails[] = [
    {
      id: 'stay-101',
      room_id: 'room-1',
      primary_guest_id: 'guest-1',
      room_number: '101',
      category_name: 'Single Standard',
      room_floor: 1,
      guest_name: 'Dr. John Snow',
      guest_email: 'john@winterfell.org',
      guest_phone: '+14155550100',
      document_type: 'PASSPORT',
      document_number: 'P123456',
      check_in_date: '2026-11-01',
      check_out_date: '2026-11-05',
      status: 'RESERVED',
      nightly_rate: 65,
      total_nights: 4,
      deposit_amount: 130,
      total_amount: 260,
      payment_status: 'PARTIAL',
      created_at: new Date().toISOString(),
    },
  ];

  it('renders header, New Reservation button, and search input', () => {
    render(
      <ReservationsManager
        stays={mockStays}
        rooms={mockRooms}
        currentUser={mockUser}
        onRefreshStays={vi.fn()}
        onCreateStay={vi.fn()}
        onUpdateStay={vi.fn()}
        onCancelStay={vi.fn()}
        onCheckOutStay={vi.fn()}
        showToast={vi.fn()}
      />
    );

    expect(screen.getByText('Reservations & Folios Management')).toBeInTheDocument();
    expect(screen.getByText('New Reservation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('renders stay cards with guest name and room number', () => {
    render(
      <ReservationsManager
        stays={mockStays}
        rooms={mockRooms}
        currentUser={mockUser}
        onRefreshStays={vi.fn()}
        onCreateStay={vi.fn()}
        onUpdateStay={vi.fn()}
        onCancelStay={vi.fn()}
        onCheckOutStay={vi.fn()}
        showToast={vi.fn()}
      />
    );

    expect(screen.getByText('Dr. John Snow')).toBeInTheDocument();
    expect(screen.getByText('Room 101')).toBeInTheDocument();
  });

  it('opens New Reservation modal when button is clicked', () => {
    render(
      <ReservationsManager
        stays={mockStays}
        rooms={mockRooms}
        currentUser={mockUser}
        onRefreshStays={vi.fn()}
        onCreateStay={vi.fn()}
        onUpdateStay={vi.fn()}
        onCancelStay={vi.fn()}
        onCheckOutStay={vi.fn()}
        showToast={vi.fn()}
      />
    );

    const newBtn = screen.getByText('New Reservation');
    fireEvent.click(newBtn);

    expect(screen.getByText('Create New VIP Reservation')).toBeInTheDocument();
  });

  it('displays Due Settle pill for partial stays and opens Folio Settlement modal', async () => {
    const handleUpdateStay = vi.fn().mockResolvedValue(undefined);
    const handleCheckOutStay = vi.fn().mockResolvedValue(undefined);
    const handleToast = vi.fn();

    render(
      <ReservationsManager
        stays={mockStays}
        rooms={mockRooms}
        currentUser={mockUser}
        onRefreshStays={vi.fn()}
        onCreateStay={vi.fn()}
        onUpdateStay={handleUpdateStay}
        onCancelStay={vi.fn()}
        onCheckOutStay={handleCheckOutStay}
        showToast={handleToast}
      />
    );

    // Verify Due pill is rendered
    expect(screen.getByText(/Due: \$130.00/i)).toBeInTheDocument();

    // Click on Due Settle button
    const dueBtn = screen.getByRole('button', { name: /Due: \$130.00 • Settle/i });
    fireEvent.click(dueBtn);

    // Verify Folio Settlement modal opens
    expect(screen.getByText('Folio Settlement & Billing')).toBeInTheDocument();
    expect(screen.getByText('Zero-Balance Policy')).toBeInTheDocument();
    expect(screen.getByText(/Pre-Authorized Card on File/i)).toBeInTheDocument();
    expect(screen.getByText(/Digital Payment Link & Mobile QR/i)).toBeInTheDocument();
    expect(screen.getByText(/Corporate City Ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/Cash Reception Settlement/i)).toBeInTheDocument();

    // Confirm settlement
    const settleBtn = screen.getByRole('button', { name: /Settle Folio \(\$130.00\) & Check-Out/i });
    fireEvent.click(settleBtn);

    await waitFor(() => {
      expect(handleUpdateStay).toHaveBeenCalledTimes(1);
      expect(handleCheckOutStay).toHaveBeenCalledTimes(1);
    });
  });
});
