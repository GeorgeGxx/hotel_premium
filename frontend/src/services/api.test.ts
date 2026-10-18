import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchRooms,
  fetchStays,
  createStay,
  updateStay,
  cancelStay,
  checkOutStay,
} from './api';

describe('Hotel Premium API Client Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchRooms should return an array of rooms with luxury attributes', async () => {
    const rooms = await fetchRooms();
    expect(Array.isArray(rooms)).toBe(true);
    expect(rooms.length).toBeGreaterThan(0);
    const room101 = rooms.find((r) => r.number === '101');
    expect(room101).toBeDefined();
    expect(room101?.category_name).toBeDefined();
    expect(room101?.base_price).toBeGreaterThan(0);
  });

  it('fetchStays should return array of active reservations', async () => {
    const stays = await fetchStays();
    expect(Array.isArray(stays)).toBe(true);
  });

  it('createStay should succeed and return stay details with calculated total_amount', async () => {
    const dto = {
      room_id: '1a7e2b10-0001-4000-8000-000000000001',
      guest_name: 'Lady Ada Lovelace',
      guest_email: 'ada@computing.org',
      guest_phone: '+442079460991',
      check_in_date: '2026-12-01',
      check_out_date: '2026-12-04',
      total_nights: 3,
      nightly_rate: 65.0,
      deposit_amount: 195.0,
      notes: 'Analytical Engine suite required',
      status: 'RESERVED' as const,
    };

    const result = await createStay(dto);
    expect(result).toBeDefined();
    expect(result.guest_name).toBe('Lady Ada Lovelace');
    expect(result.total_nights).toBe(3);
    expect(result.nightly_rate).toBe(65.0);
    expect(result.total_amount).toBe(195.0);
  });

  it('createStay should throw when backend returns 409 Conflict (double booking)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: async () => ({ error: 'Room is already booked for this period.' }),
    } as Response);

    const dto = {
      room_id: '1a7e2b10-0001-4000-8000-000000000001',
      guest_name: 'Overlapping Guest',
      guest_email: 'conflict@test.com',
      guest_phone: '+14155550000',
      check_in_date: '2026-12-02',
      check_out_date: '2026-12-03',
      total_nights: 1,
      nightly_rate: 65.0,
      deposit_amount: 65.0,
      status: 'RESERVED' as const,
    };

    await expect(createStay(dto)).rejects.toThrow('Room is already booked');
  });

  it('updateStay should update total_amount and stay duration', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        id: '1a7e2b10-0001-4000-8000-000000000001',
        total_nights: 4,
        nightly_rate: 95.0,
        total_amount: 380.0,
        notes: 'Extended VIP stay',
      }),
    } as Response);

    const updated = await updateStay('1a7e2b10-0001-4000-8000-000000000001', {
      total_nights: 4,
      nightly_rate: 95.0,
      notes: 'Extended VIP stay',
    });

    expect(updated).toBeDefined();
    expect(updated.total_nights).toBe(4);
    expect(updated.total_amount).toBe(380.0);
  });

  it('cancelStay should complete cleanly without throwing', async () => {
    await expect(cancelStay('stay-1')).resolves.toBeUndefined();
  });

  it('checkOutStay should complete cleanly without throwing', async () => {
    await expect(checkOutStay('stay-1')).resolves.toBeUndefined();
  });
});
