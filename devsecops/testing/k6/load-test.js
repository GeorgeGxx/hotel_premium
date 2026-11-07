import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<250', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const TARGET_URL = __ENV.TARGET_URL || 'http://localhost:8000';

export default function () {
  // 1. Test North-South Gateway Health & Room Inventory Catalog
  const roomsRes = http.get(`${TARGET_URL}/api/v1/rooms`, {
    headers: { Accept: 'application/json' },
  });

  check(roomsRes, {
    'GET /api/v1/rooms is status 200': (r) => r.status === 200,
    'GET /api/v1/rooms latency < 200ms': (r) => r.timings.duration < 200,
  });

  // 2. Test Reservations & Stays Query
  const staysRes = http.get(`${TARGET_URL}/api/v1/stays`, {
    headers: { Accept: 'application/json' },
  });

  check(staysRes, {
    'GET /api/v1/stays is status 200': (r) => r.status === 200,
  });

  // 3. Test Billing POS Products Catalog
  const billingRes = http.get(`${TARGET_URL}/api/v1/billing/products`, {
    headers: { Accept: 'application/json' },
  });

  check(billingRes, {
    'GET /api/v1/billing/products is status 200': (r) => r.status === 200,
  });

  sleep(1);
}
