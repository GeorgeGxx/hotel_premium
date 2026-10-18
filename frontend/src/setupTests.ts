import '@testing-library/jest-dom/vitest';

// Provide fallback fetch mock for relative URLs in JSDOM environment
const originalFetch = global.fetch;
global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = input.toString();
  if (url.startsWith('/')) {
    url = `http://localhost:8000${url}`;
  }
  try {
    return await originalFetch(url, init);
  } catch {
    return new Response(JSON.stringify({ error: 'Network fallback' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
