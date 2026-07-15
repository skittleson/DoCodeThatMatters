import { getToken, clearToken } from './tokenStore';
import { authenticate } from './githubClient';

export interface AutoAuthResult {
  success: boolean;
  token?: string;
}

export async function autoAuthenticate(): Promise<AutoAuthResult | null> {
  const stored = getToken();
  if (!stored) {
    return null;
  }

  try {
    const ok = await authenticate(stored);
    if (ok) {
      return { success: true, token: stored };
    }
    // Token was invalid — clear it so the user can start fresh
    clearToken();
    return { success: false };
  } catch {
    // Network error — clear token to avoid repeated failures
    clearToken();
    return { success: false };
  }
}

export function handleLogout(): void {
  clearToken();
}
