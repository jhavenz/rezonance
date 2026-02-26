import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { client, configureClient } from '../../src/js/client/kubb-client';
import type { ResonanceSignal } from '../../src/js/types/envelope';

// Mock the errorStore
vi.mock('../../src/js/devtools/ErrorStore', () => ({
  errorStore: {
    add: vi.fn(),
  },
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Kubb Client', () => {
  let signalProcessor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    signalProcessor = vi.fn();

    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });

    // Reset client configuration to defaults
    configureClient({
      baseUrl: '/api',
      getHeaders: () => ({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      signalProcessor,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configureClient', () => {
    it('should configure base URL', async () => {
      configureClient({ baseUrl: '/v2/api' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: {}, meta: {} }),
      });

      await client({ url: '/users' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/v2/api/users',
        expect.any(Object)
      );
    });

    it('should configure custom headers', async () => {
      const customHeaders = vi.fn(() => ({
        'Content-Type': 'application/json',
        Authorization: 'Bearer custom-token',
      }));

      configureClient({ getHeaders: customHeaders });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: {}, meta: {} }),
      });

      await client({ url: '/users' });

      expect(customHeaders).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-token',
          }),
        })
      );
    });
  });

  describe('client', () => {
    describe('Request Building', () => {
      it('should make GET request by default', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: { id: 1 }, meta: {} }),
        });

        await client({ url: '/users' });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/users',
          expect.objectContaining({
            method: 'GET',
            credentials: 'include',
          })
        );
      });

      it('should append query params to URL', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: [], meta: {} }),
        });

        await client({
          url: '/users',
          params: { page: 1, limit: 10, search: 'test' },
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/users?page=1&limit=10&search=test',
          expect.any(Object)
        );
      });

      it('should skip null and undefined params', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: [], meta: {} }),
        });

        await client({
          url: '/users',
          params: { page: 1, filter: null, sort: undefined, active: true },
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/users?page=1&active=true',
          expect.any(Object)
        );
      });

      it('should stringify JSON body for POST', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: { id: 1 }, meta: {} }),
        });

        const data = { name: 'Test', email: 'test@example.com' };
        await client({
          url: '/users',
          method: 'POST',
          data,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/users',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(data),
          })
        );
      });

      it('should handle FormData without Content-Type', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: {}, meta: {} }),
        });

        const formData = new FormData();
        formData.append('file', new Blob(['test']), 'test.txt');

        await client({
          url: '/upload',
          method: 'POST',
          data: formData,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/upload',
          expect.objectContaining({
            body: formData,
            headers: expect.not.objectContaining({
              'Content-Type': expect.anything(),
            }),
          })
        );
      });

      it('should merge custom headers', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: {}, meta: {} }),
        });

        await client({
          url: '/users',
          headers: { 'X-Custom-Header': 'custom-value' },
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/users',
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-Custom-Header': 'custom-value',
            }),
          })
        );
      });

      it('should pass AbortSignal', async () => {
        const controller = new AbortController();

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: {}, meta: {} }),
        });

        await client({
          url: '/users',
          signal: controller.signal,
        });

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/users',
          expect.objectContaining({
            signal: controller.signal,
          })
        );
      });
    });

    describe('Response Handling', () => {
      it('should return data from envelope', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: { id: 1, name: 'Test' },
            meta: { signals: [], timestamp: 123, trace_id: 'abc' },
          }),
        });

        const result = await client<{ id: number; name: string }>({ url: '/users/1' });

        expect(result.data).toEqual({ id: 1, name: 'Test' });
        expect(result.status).toBe(200);
        expect(result.statusText).toBe('OK');
      });

      it('should process signals on mutation success', async () => {
        const signals: ResonanceSignal[] = [
          { type: 'invalidate', scope: ['users.index'] },
          { type: 'flash', message: 'User created!', variant: 'success' },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: { id: 1 },
            meta: { signals, timestamp: 123, trace_id: 'abc' },
          }),
        });

        await client({
          url: '/users',
          method: 'POST',
          data: { name: 'Test' },
        });

        expect(signalProcessor).toHaveBeenCalledWith(signals);
      });

      it('should NOT process signals on GET request', async () => {
        const signals: ResonanceSignal[] = [
          { type: 'flash', message: 'Test', variant: 'info' },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: {},
            meta: { signals, timestamp: 123, trace_id: 'abc' },
          }),
        });

        await client({ url: '/users' });

        expect(signalProcessor).not.toHaveBeenCalled();
      });
    });

    describe('CSRF Token Refresh (419)', () => {
      it('should refresh CSRF token and retry on 419', async () => {
        // First request: 419 (CSRF expired)
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 419,
        });

        // CSRF refresh request
        mockFetch.mockResolvedValueOnce({ ok: true });

        // Retry: Success
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: { success: true }, meta: {} }),
        });

        const result = await client({
          url: '/users',
          method: 'POST',
        });

        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockFetch).toHaveBeenNthCalledWith(2, '/sanctum/csrf-cookie', {
          credentials: 'include',
        });
        expect(result.data).toEqual({ success: true });
      });
    });

    describe('Error Handling', () => {
      it('should throw error with status and data on failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: {
              errors: { email: ['Invalid email'] },
            },
            meta: {},
          }),
        });

        await expect(client({ url: '/users', method: 'POST' })).rejects.toMatchObject({
          status: 422,
          message: 'Request failed: 422 Unprocessable Entity',
        });
      });

      it('should process signals from error responses', async () => {
        const signals: ResonanceSignal[] = [
          { type: 'flash', message: 'Please log in', variant: 'error' },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            data: null,
            meta: { signals, timestamp: 123, trace_id: 'abc' },
          }),
        });

        await expect(client({ url: '/protected' })).rejects.toThrow();

        expect(signalProcessor).toHaveBeenCalledWith(signals);
      });

      it('should handle HTML error responses (dd/dump)', async () => {
        const { errorStore } = await import('../../src/js/devtools/ErrorStore');

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({ 'content-type': 'text/html' }),
          text: () => Promise.resolve('<html><body>Debug output</body></html>'),
        });

        await expect(client({ url: '/buggy' })).rejects.toThrow();

        expect(errorStore.add).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            html: '<html><body>Debug output</body></html>',
          })
        );
      });

      it('should handle JSON parse failure gracefully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.reject(new Error('Invalid JSON')),
        });

        await expect(client({ url: '/buggy' })).rejects.toMatchObject({
          status: 500,
        });
      });

      it('should throw on successful response JSON parse failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.reject(new SyntaxError('Unexpected token')),
        });

        await expect(client({ url: '/users' })).rejects.toThrow(SyntaxError);
      });
    });

    describe('HTTP Methods', () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

      for (const method of methods) {
        it(`should handle ${method} requests`, async () => {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            status: method === 'DELETE' ? 204 : 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ data: {}, meta: {} }),
          });

          await client({
            url: '/users/1',
            method,
            data: method !== 'DELETE' ? { name: 'Updated' } : undefined,
          });

          expect(mockFetch).toHaveBeenCalledWith(
            '/api/users/1',
            expect.objectContaining({
              method,
            })
          );
        });
      }
    });
  });
});
