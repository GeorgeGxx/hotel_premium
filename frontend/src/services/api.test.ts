import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchRooms,
  fetchStays,
  createStay,
  updateStay,
  cancelStay,
  checkOutStay,
  setDemoMockMode,
  ApiError,
} from './api';
import { generatePkceChallenge, decodeUserFromToken } from './auth';

describe('Hotel Premium API Client & OIDC Auth Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setDemoMockMode(true);
  });

  it('fetchRooms should return an array of rooms with luxury attributes in demo mode', async () => {
    const rooms = await fetchRooms();
    expect(Array.isArray(rooms)).toBe(true);
    expect(rooms.length).toBeGreaterThan(0);
    const room101 = rooms.find((r) => r.number === '101');
    expect(room101).toBeDefined();
    expect(room101?.category_name).toBeDefined();
    expect(room101?.base_price).toBeGreaterThan(0);
  });

  it('fetchRooms should NOT fall back to mock data when demo mode is disabled (production mode)', async () => {
    setDemoMockMode(false);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 503,
      ok: false,
      json: async () => ({ error: 'Backend database unavailable' }),
    } as Response);

    await expect(fetchRooms()).rejects.toThrow(ApiError);
  });

  it('fetchStays should preserve an empty array [] returned by backend without replacing with mock stays', async () => {
    setDemoMockMode(false);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => [],
    } as Response);

    const stays = await fetchStays();
    expect(stays).toEqual([]);
  });

  it('fetchStays should return array of active reservations in demo fallback mode', async () => {
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
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

  it('checkOutStay should forward settlement payload when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ status: 'checked_out' }),
    } as Response);

    await expect(
      checkOutStay('stay-1', {
        deposit_amount: 250.0,
        payment_status: 'PAID',
        notes: 'Card settlement',
      })
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0];
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({
      deposit_amount: 250.0,
      payment_status: 'PAID',
      notes: 'Card settlement',
    });
  });

  it('generatePkceChallenge should produce valid RFC 7636 verifier and S256 challenge', async () => {
    const { verifier, challenge } = await generatePkceChallenge();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge.length).toBeGreaterThanOrEqual(43);
    expect(challenge).not.toBe(verifier);
  });

  it('decodeUserFromToken should extract Keycloak realm_access roles accurately', () => {
    const payload = btoa(
      JSON.stringify({
        preferred_username: 'elena_admin',
        name: 'Elena Vance',
        email: 'elena@hotelpremium.com',
        realm_access: { roles: ['USER', 'ADMIN'] },
      })
    );
    const fakeJwt = `eyJhbGciOiJSUzI1NiJ9.${payload}.sig`;
    const user = decodeUserFromToken(fakeJwt);
    expect(user?.username).toBe('elena_admin');
    expect(user?.role).toBe('ADMIN');
  });
});
