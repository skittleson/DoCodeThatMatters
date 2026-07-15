import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

import { getToken, setToken, clearToken } from '../lib/tokenStore';

vi.mock('../lib/githubClient', () => ({
  authenticate: vi.fn(),
}));

import { autoAuthenticate, handleLogout } from '../lib/autoAuth';
import { authenticate } from '../lib/githubClient';

describe('tokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('clears the token', () => {
    setToken('abc123');
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe('autoAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns success when stored token authenticates', async () => {
    setToken('valid-token');
    (authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const result = await autoAuthenticate();
    expect(result).toEqual({ success: true, token: 'valid-token' });
    expect(authenticate).toHaveBeenCalledWith('valid-token');
  });

  it('returns failure and clears token when stored token fails authentication', async () => {
    setToken('bad-token');
    (authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const result = await autoAuthenticate();
    expect(result).toEqual({ success: false });
    expect(authenticate).toHaveBeenCalledWith('bad-token');
    expect(getToken()).toBeNull();
  });

  it('returns null when no token is stored', async () => {
    const result = await autoAuthenticate();
    expect(result).toBeNull();
  });

  it('returns failure on network error during auth and clears token', async () => {
    setToken('some-token');
    (authenticate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    const result = await autoAuthenticate();
    expect(result).toEqual({ success: false });
    expect(getToken()).toBeNull();
  });

  it('clears token on logout', () => {
    setToken('valid-token');
    handleLogout();
    expect(getToken()).toBeNull();
  });
});
