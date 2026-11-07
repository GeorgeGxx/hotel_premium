import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoomMatrix } from './RoomMatrix';
import { Room } from '../types/hotel';

describe('RoomMatrix Component (Frontend TDD)', () => {
  const mockRooms: Room[] = [
    {
      id: 'room-101',
      number: '101',
      category_id: 'cat-std',
      category_name: 'Deluxe King',
      floor: 1,
      capacity: 2,
      base_price: 150.0,
      status: 'AVAILABLE',
      created_at: '2026-10-18T10:00:00Z',
      updated_at: '2026-10-18T10:00:00Z',
    },
    {
      id: 'room-102',
      number: '102',
      category_id: 'cat-ste',
      category_name: 'Presidential Suite',
      floor: 1,
      capacity: 4,
      base_price: 450.0,
      status: 'OCCUPIED',
      created_at: '2026-10-18T10:00:00Z',
      updated_at: '2026-10-18T10:00:00Z',
    },
    {
      id: 'room-201',
      number: '201',
      category_id: 'cat-std',
      category_name: 'Deluxe King',
      floor: 2,
      capacity: 2,
      base_price: 220.0,
      status: 'DIRTY',
      created_at: '2026-10-18T10:00:00Z',
      updated_at: '2026-10-18T10:00:00Z',
    },
  ];

  it('renders room matrix cards with room numbers, prices, and status badges', () => {
    render(
      <RoomMatrix
        rooms={mockRooms}
        onCheckInClick={vi.fn()}
        onCheckOutClick={vi.fn()}
        onMarkCleanedClick={vi.fn()}
      />
    );

    expect(screen.getByText('Front Desk Room Matrix')).toBeInTheDocument();
    expect(screen.getByText(/3 of 3 rooms/i)).toBeInTheDocument();

    // Verify rooms rendered
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();

    // Verify status labels
    expect(screen.getAllByText('Available').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Occupied').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dirty / Clean Req.')).toBeInTheDocument();

    // Verify pricing format
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();
  });

  it('filters rooms by search input query', () => {
    render(
      <RoomMatrix
        rooms={mockRooms}
        onCheckInClick={vi.fn()}
        onCheckOutClick={vi.fn()}
        onMarkCleanedClick={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Room or type...');
    fireEvent.change(searchInput, { target: { value: 'Presidential' } });

    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.queryByText('101')).not.toBeInTheDocument();
    expect(screen.queryByText('201')).not.toBeInTheDocument();
  });

  it('triggers onCheckInClick handler when clicking Check-In for an available room', () => {
    const handleCheckIn = vi.fn();
    render(
      <RoomMatrix
        rooms={mockRooms}
        onCheckInClick={handleCheckIn}
        onCheckOutClick={vi.fn()}
        onMarkCleanedClick={vi.fn()}
      />
    );

    const checkInBtn = screen.getByRole('button', { name: /Check-In/i });
    fireEvent.click(checkInBtn);

    expect(handleCheckIn).toHaveBeenCalledTimes(1);
    expect(handleCheckIn).toHaveBeenCalledWith(mockRooms[0]);
  });

  it('triggers onCheckOutClick handler when clicking Folio & Check-Out for an occupied room', () => {
    const handleCheckOut = vi.fn();
    render(
      <RoomMatrix
        rooms={mockRooms}
        onCheckInClick={vi.fn()}
        onCheckOutClick={handleCheckOut}
        onMarkCleanedClick={vi.fn()}
      />
    );

    const checkOutBtn = screen.getByRole('button', { name: /Folio & Check-Out/i });
    fireEvent.click(checkOutBtn);

    expect(handleCheckOut).toHaveBeenCalledTimes(1);
    expect(handleCheckOut).toHaveBeenCalledWith(mockRooms[1]);
  });

  it('triggers onMarkCleanedClick handler when clicking Mark Cleaned for dirty room', () => {
    const handleCleaned = vi.fn();
    render(
      <RoomMatrix
        rooms={mockRooms}
        onCheckInClick={vi.fn()}
        onCheckOutClick={vi.fn()}
        onMarkCleanedClick={handleCleaned}
      />
    );

    const cleanBtn = screen.getByRole('button', { name: /Mark Cleaned/i });
    fireEvent.click(cleanBtn);

    expect(handleCleaned).toHaveBeenCalledTimes(1);
    expect(handleCleaned).toHaveBeenCalledWith(mockRooms[2]);
  });

  it('opens operational status modal and triggers onUpdateStatus to MAINTENANCE', () => {
    const handleUpdateStatus = vi.fn();
    render(
      <RoomMatrix
        rooms={mockRooms}
        onCheckInClick={vi.fn()}
        onCheckOutClick={vi.fn()}
        onMarkCleanedClick={vi.fn()}
        onUpdateStatus={handleUpdateStatus}
      />
    );

    // Click on the status override button for room 101
    const optionsBtn = screen.getByRole('button', { name: /Change Status for Room 101/i });
    fireEvent.click(optionsBtn);

    // Modal opens
    expect(screen.getByText('Change Suite Status')).toBeInTheDocument();
    expect(screen.getByText(/Suite 101/i)).toBeInTheDocument();

    // Select Maintenance
    const maintOption = screen.getByText('Maintenance (Out of Order - OOO)');
    fireEvent.click(maintOption);

    // Confirm status transition
    const confirmBtn = screen.getByRole('button', { name: /Confirm Status Change/i });
    fireEvent.click(confirmBtn);

    expect(handleUpdateStatus).toHaveBeenCalledTimes(1);
    expect(handleUpdateStatus).toHaveBeenCalledWith(
      mockRooms[0],
      'MAINTENANCE',
      expect.any(String)
    );
  });
});
