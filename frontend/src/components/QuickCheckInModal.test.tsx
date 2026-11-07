import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickCheckInModal } from './QuickCheckInModal';
import { Room } from '../types/hotel';

describe('QuickCheckInModal Component', () => {
  const mockRoom: Room = {
    id: 'room-101',
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
  };

  it('renders with dark luxury header and suite number', () => {
    render(
      <QuickCheckInModal
        room={mockRoom}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/Guest Check-In • Suite 101/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Lady Vivienne Westwood/i)).toBeInTheDocument();
  });

  it('allows filling guest info and selecting deposit presets', () => {
    const handleSubmit = vi.fn();
    render(
      <QuickCheckInModal
        room={mockRoom}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
      />
    );

    // Fill name and doc
    fireEvent.change(screen.getByPlaceholderText(/Lady Vivienne Westwood/i), {
      target: { value: 'Alexander McQueen' },
    });
    fireEvent.change(screen.getByPlaceholderText(/P12345678/i), {
      target: { value: 'UK998877' },
    });

    // Click 50% deposit preset
    const dep50Btn = screen.getByText('50% Dep.');
    fireEvent.click(dep50Btn);

    // Verify balance due is shown and folio is marked partial
    expect(screen.getByText(/Folio: PARTIAL/i)).toBeInTheDocument();

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Check In/i }));

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-101',
        guestName: 'Alexander McQueen',
        documentNumber: 'UK998877',
      })
    );
  });
});
