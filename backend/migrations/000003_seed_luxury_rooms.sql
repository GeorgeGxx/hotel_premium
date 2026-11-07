-- 000003_seed_luxury_rooms.sql
-- Hotel Premium Luxury Suite & Standard Rooms Seeding

INSERT INTO rooms (number, category_id, floor, status, notes)
SELECT '101', id, 1, 'AVAILABLE', 'Corner Deluxe Single with Garden Terrace' FROM room_categories WHERE code = 'SGL'
ON CONFLICT (number) DO NOTHING;

INSERT INTO rooms (number, category_id, floor, status, notes)
SELECT '102', id, 1, 'AVAILABLE', 'Garden View Double Deluxe with King Bed' FROM room_categories WHERE code = 'DBL'
ON CONFLICT (number) DO NOTHING;

INSERT INTO rooms (number, category_id, floor, status, notes)
SELECT '201', id, 2, 'AVAILABLE', 'Executive Suite with Ocean View Balcony' FROM room_categories WHERE code = 'DBL'
ON CONFLICT (number) DO NOTHING;

INSERT INTO rooms (number, category_id, floor, status, notes)
SELECT '202', id, 2, 'AVAILABLE', 'Executive Presidential Panoramic Skyline Penthouse' FROM room_categories WHERE code = 'STE'
ON CONFLICT (number) DO NOTHING;

INSERT INTO rooms (number, category_id, floor, status, notes)
SELECT '301', id, 3, 'AVAILABLE', 'Presidential Panoramic Penthouse Suite & Private Jacuzzi' FROM room_categories WHERE code = 'STE'
ON CONFLICT (number) DO NOTHING;

INSERT INTO rooms (number, category_id, floor, status, notes)
SELECT '302', id, 3, 'AVAILABLE', 'VIP Ocean Panorama Corner Presidential Suite' FROM room_categories WHERE code = 'STE'
ON CONFLICT (number) DO NOTHING;
