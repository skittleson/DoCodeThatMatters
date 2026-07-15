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
