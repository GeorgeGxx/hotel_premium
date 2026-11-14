import { CurrentUser, UserRole } from '../types/hotel';

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'hotel-realm';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'hotel-frontend';

const STORAGE_ACCESS_TOKEN = 'hp_oidc_access_token';
const STORAGE_REFRESH_TOKEN = 'hp_oidc_refresh_token';
const STORAGE_EXPIRES_AT = 'hp_oidc_expires_at';
const STORAGE_CODE_VERIFIER = 'hp_oidc_pkce_verifier';
const STORAGE_OAUTH_STATE = 'hp_oidc_oauth_state';
const STORAGE_ACTIVE_ROLE = 'hp_active_role';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generatePkceChallenge(): Promise<{ verifier: string; challenge: string }> {
  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  }
  const verifier = base64UrlEncode(randomBytes);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
    const challenge = base64UrlEncode(new Uint8Array(digest));
    return { verifier, challenge };
  }

  return { verifier, challenge: verifier };
}

export async function startKeycloakPkceLogin(redirectUri = window.location.origin): Promise<void> {
  const { verifier, challenge } = await generatePkceChallenge();
  const stateBytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(stateBytes);
  }
  const state = base64UrlEncode(stateBytes);

  sessionStorage.setItem(STORAGE_CODE_VERIFIER, verifier);
  sessionStorage.setItem(STORAGE_OAUTH_STATE, state);

  const authUrl = new URL(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`);
  authUrl.searchParams.set('client_id', KEYCLOAK_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(authUrl.toString());
}

export async function handleOidcRedirectCallback(redirectUri = window.location.origin): Promise<CurrentUser | null> {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    return null;
  }

  const expectedState = sessionStorage.getItem(STORAGE_OAUTH_STATE);
  const verifier = sessionStorage.getItem(STORAGE_CODE_VERIFIER);
  sessionStorage.removeItem(STORAGE_OAUTH_STATE);
  sessionStorage.removeItem(STORAGE_CODE_VERIFIER);

  if (!expectedState || state !== expectedState || !verifier) {
    throw new Error('OIDC PKCE state or verifier validation failed');
  }

  const tokenEndpoint = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: KEYCLOAK_CLIENT_ID,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`OIDC token exchange failed with HTTP ${res.status}`);
  }

  const tokenData = await res.json();
  storeTokens(tokenData.access_token, tokenData.refresh_token, tokenData.expires_in || 300);

  // Clean OAuth parameters from URL bar
  const cleanUrl = window.location.pathname + window.location.hash;
  window.history.replaceState({}, document.title, cleanUrl);

  return decodeUserFromToken(tokenData.access_token);
}

export function storeTokens(accessToken: string, refreshToken?: string, expiresInSec = 300): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_ACCESS_TOKEN, accessToken);
  if (refreshToken) {
    sessionStorage.setItem(STORAGE_REFRESH_TOKEN, refreshToken);
  }
  const expiresAt = Date.now() + expiresInSec * 1000;
  sessionStorage.setItem(STORAGE_EXPIRES_AT, String(expiresAt));
}

export function clearAuthSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(STORAGE_ACCESS_TOKEN);
  sessionStorage.removeItem(STORAGE_REFRESH_TOKEN);
  sessionStorage.removeItem(STORAGE_EXPIRES_AT);
}

export async function refreshAccessToken(): Promise<string | null> {
  if (typeof sessionStorage === 'undefined') return null;
  const refreshToken = sessionStorage.getItem(STORAGE_REFRESH_TOKEN);
  if (!refreshToken) return null;

  try {
    const tokenEndpoint = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: KEYCLOAK_CLIENT_ID,
      refresh_token: refreshToken,
    });

    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      clearAuthSession();
      return null;
    }

    const data = await res.json();
    storeTokens(data.access_token, data.refresh_token, data.expires_in || 300);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  if (typeof sessionStorage === 'undefined') return null;
  const token = sessionStorage.getItem(STORAGE_ACCESS_TOKEN);
  if (!token) return null;

  const expiresAt = Number(sessionStorage.getItem(STORAGE_EXPIRES_AT) || '0');
  if (expiresAt > 0 && Date.now() + 30000 >= expiresAt) {
    return refreshAccessToken();
  }
  return token;
}

export function setActiveSessionRole(role: UserRole): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_ACTIVE_ROLE, role);
}

export function getActiveSessionRole(): UserRole {
  if (typeof sessionStorage === 'undefined') return 'USER';
  const r = sessionStorage.getItem(STORAGE_ACTIVE_ROLE);
  return r === 'ADMIN' ? 'ADMIN' : 'USER';
}

export function decodeUserFromToken(token: string): CurrentUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(payloadJson);

    const realmRoles: string[] = claims?.realm_access?.roles || claims?.roles || [];
    const normalizedRoles = realmRoles.map((r) => String(r).toUpperCase());
    const role: UserRole =
      normalizedRoles.includes('ADMIN') || String(claims.role || '').toUpperCase() === 'ADMIN'
        ? 'ADMIN'
        : 'USER';

    return {
      username: claims.preferred_username || claims.sub || 'authenticated_user',
      fullName: claims.name || claims.preferred_username || 'Authenticated Operator',
      role,
      email: claims.email || 'operator@hotelpremium.com',
    };
  } catch {
    return null;
  }
}
