/** Decoded JWT payload - only the fields ACMS cares about. */
export interface JwtPayload {
  sub?: string;
  unique_name?: string;
  exp?: number;          // seconds since epoch
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

/** Base64url -> string, with padding repair and correct UTF-8 handling. */
function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Reads the role claim. .NET may emit it as 'role' or as the full
 * WS-Federation URI depending on claim-type mapping, so check both.
 */
export function readRole(payload: JwtPayload): string | null {
  const keys = [
    'role',
    'roles',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  ];

  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.length) return String(value[0]);
  }
  return null;
}

export function readUsername(payload: JwtPayload): string | null {
  return (
    payload.unique_name ??
    (payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string) ??
    payload.sub ??
    null
  );
}

/** True when the token is missing, malformed, or past its exp claim. */
export function isExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  // 30s skew guard so we don't send a token that dies mid-flight
  return payload.exp * 1000 <= Date.now() + 30_000;
}