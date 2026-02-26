import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createNetworkAdapter,
  ResonanceValidationError,
  ResonanceAuthError,
} from '../../src/js/client/NetworkAdapter';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NetworkAdapter', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNavigate = vi.fn();
    vi.clearAllMocks();

    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cookie Adapter', () => {
    const createCookieAdapter = (csrfEndpoint?: string) =>
      createNetworkAdapter(
        { driver: 'cookie', csrfEndpoint },
        '/api',
        mockNavigate,
        '/login'
      );

    describe('getHeaders', () => {
      it('should return base headers without XSRF token', () => {
        const adapter = createCookieAdapter();
        const headers = adapter.getHeaders();

        expect(headers).toEqual({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        });
      });

      it('should include XSRF token when cookie exists', () => {
        document.cookie = 'XSRF-TOKEN=test-token-123';
        const adapter = createCookieAdapter();
        const headers = adapter.getHeaders();

        expect(headers).toEqual({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-XSRF-TOKEN': 'test-token-123',
        });
      });

      it('should decode URL-encoded XSRF token', () => {
        document.cookie = 'XSRF-TOKEN=token%2Bwith%2Bspecial%3Dchars';
        const adapter = createCookieAdapter();
        const headers = adapter.getHeaders();

        expect(headers['X-XSRF-TOKEN']).toBe('token+with+special=chars');
      });
    });

    describe('fetch', () => {
      it('should make GET request with correct URL and headers', async () => {
        document.cookie = 'XSRF-TOKEN=csrf-token';
        const adapter = createCookieAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: { id: 1 }, meta: {} })),
        });

        const result = await adapter.fetch('/users');

        expect(mockFetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': 'csrf-token',
          }),
        }));
        expect(result.data).toEqual({ id: 1 });
      });

      it('should fetch CSRF token before POST request', async () => {
        const adapter = createCookieAdapter();

        // First call: CSRF endpoint
        mockFetch.mockResolvedValueOnce({ ok: true });

        // Second call: actual POST
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: { created: true }, meta: {} })),
        });

        await adapter.fetch('/users', {
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenNthCalledWith(1, '/sanctum/csrf-cookie', {
          credentials: 'include',
        });
      });

      it('should use custom CSRF endpoint', async () => {
        const adapter = createCookieAdapter('/custom/csrf');

        mockFetch.mockResolvedValueOnce({ ok: true });
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: {}, meta: {} })),
        });

        await adapter.fetch('/users', { method: 'POST' });

        expect(mockFetch).toHaveBeenNthCalledWith(1, '/custom/csrf', {
          credentials: 'include',
        });
      });

      it('should skip CSRF fetch if token already exists', async () => {
        document.cookie = 'XSRF-TOKEN=existing-token';
        const adapter = createCookieAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: {}, meta: {} })),
        });

        await adapter.fetch('/users', { method: 'POST' });

        // Only the POST request should be made
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it('should throw ResonanceValidationError on 422', async () => {
        // Set CSRF cookie to avoid CSRF fetch
        document.cookie = 'XSRF-TOKEN=test-token';
        const adapter = createCookieAdapter();

        const validationErrors = {
          email: ['The email field is required.'],
          name: ['The name must be at least 3 characters.'],
        };

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: () => Promise.resolve({ errors: validationErrors }),
        });

        try {
          await adapter.fetch('/users', { method: 'POST' });
          // Should not reach here
          expect.fail('Expected ResonanceValidationError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ResonanceValidationError);
          expect((error as ResonanceValidationError).errors).toEqual(validationErrors);
          expect((error as ResonanceValidationError).status).toBe(422);
        }
      });

      it('should throw ResonanceAuthError and redirect on 401', async () => {
        const adapter = createCookieAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

        await expect(adapter.fetch('/protected')).rejects.toThrow(ResonanceAuthError);
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });

      it('should throw ResonanceAuthError and redirect on 419', async () => {
        const adapter = createCookieAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 419,
        });

        await expect(adapter.fetch('/protected')).rejects.toThrow(ResonanceAuthError);
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });

      it('should throw generic Error on other HTTP errors', async () => {
        const adapter = createCookieAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        await expect(adapter.fetch('/users')).rejects.toThrow(
          'Request failed: 500 Internal Server Error'
        );
      });
    });
  });

  describe('Sanctum Token Adapter', () => {
    const createTokenAdapter = (storage: 'localStorage' | 'memory' = 'localStorage') =>
      createNetworkAdapter(
        { driver: 'sanctum-token', tokenStorage: storage },
        '/api',
        mockNavigate,
        '/login'
      );

    beforeEach(() => {
      localStorage.clear();
    });

    describe('getHeaders', () => {
      it('should return base headers without token', () => {
        const adapter = createTokenAdapter();
        const headers = adapter.getHeaders();

        expect(headers).toEqual({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        });
      });

      it('should include Authorization header when token is set', () => {
        localStorage.setItem('resonance_token', 'jwt-token-123');
        const adapter = createTokenAdapter();
        const headers = adapter.getHeaders();

        expect(headers).toEqual({
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Authorization: 'Bearer jwt-token-123',
        });
      });
    });

    describe('setToken', () => {
      it('should set token in localStorage', () => {
        const adapter = createTokenAdapter();

        adapter.setToken?.('new-token');
        expect(localStorage.getItem('resonance_token')).toBe('new-token');

        // Verify headers now include the token
        const headers = adapter.getHeaders();
        expect(headers['Authorization']).toBe('Bearer new-token');
      });

      it('should clear token from localStorage when null', () => {
        localStorage.setItem('resonance_token', 'existing-token');
        const adapter = createTokenAdapter();

        adapter.setToken?.(null);
        expect(localStorage.getItem('resonance_token')).toBeNull();
      });

      it('should work with memory storage', () => {
        const adapter = createTokenAdapter('memory');

        adapter.setToken?.('memory-token');

        // Token should not be in localStorage
        expect(localStorage.getItem('resonance_token')).toBeNull();

        // But headers should still include it
        const headers = adapter.getHeaders();
        expect(headers['Authorization']).toBe('Bearer memory-token');
      });
    });

    describe('fetch', () => {
      it('should include Authorization header in requests', async () => {
        localStorage.setItem('resonance_token', 'my-token');
        const adapter = createTokenAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: {}, meta: {} })),
        });

        await adapter.fetch('/users');

        expect(mockFetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }));
      });

      it('should not include credentials: include for token adapter', async () => {
        const adapter = createTokenAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ data: {}, meta: {} })),
        });

        await adapter.fetch('/users');

        // Token adapter doesn't use cookies
        expect(mockFetch).toHaveBeenCalledWith('/api/users', expect.not.objectContaining({
          credentials: 'include',
        }));
      });

      it('should clear token and redirect on 401', async () => {
        localStorage.setItem('resonance_token', 'expired-token');
        const adapter = createTokenAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
        });

        await expect(adapter.fetch('/protected')).rejects.toThrow(ResonanceAuthError);

        expect(localStorage.getItem('resonance_token')).toBeNull();
        expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      });

      it('should throw ResonanceValidationError on 422', async () => {
        const adapter = createTokenAdapter();

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: () => Promise.resolve({
            errors: { field: ['Error message'] },
          }),
        });

        await expect(adapter.fetch('/users', { method: 'POST' })).rejects.toThrow(
          ResonanceValidationError
        );
      });
    });
  });

  describe('Error Classes', () => {
    describe('ResonanceValidationError', () => {
      it('should have correct properties', () => {
        const errors = { email: ['Invalid email'] };
        const error = new ResonanceValidationError(errors);

        expect(error.name).toBe('ResonanceValidationError');
        expect(error.message).toBe('Validation failed');
        expect(error.errors).toEqual(errors);
        expect(error.status).toBe(422);
      });

      it('should accept custom status', () => {
        const error = new ResonanceValidationError({}, 400);
        expect(error.status).toBe(400);
      });
    });

    describe('ResonanceAuthError', () => {
      it('should have correct properties', () => {
        const error = new ResonanceAuthError(401);

        expect(error.name).toBe('ResonanceAuthError');
        expect(error.message).toBe('Authentication required');
        expect(error.status).toBe(401);
      });

      it('should accept custom message', () => {
        const error = new ResonanceAuthError(419, 'Session expired');
        expect(error.message).toBe('Session expired');
      });
    });
  });
});
