import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import type { ResonanceSignal } from '../../src/js/types/envelope';
import { createResonanceClient } from '../../src/js/client/ResonanceClient';
import type { NetworkAdapter } from '../../src/js/client/NetworkAdapter';

// Mock the errorStore
vi.mock('../../src/js/devtools/ErrorStore', () => ({
  errorStore: {
    add: vi.fn(),
  },
}));

describe('Signal Processing', () => {
  let mockQueryClient: QueryClient;
  let mockRouter: AnyRouter;
  let mockNetworkAdapter: NetworkAdapter;
  let mockToaster: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup mock QueryClient
    mockQueryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;

    // Setup mock Router
    mockRouter = {
      navigate: vi.fn(),
      invalidate: vi.fn(),
    } as unknown as AnyRouter;

    // Setup mock NetworkAdapter
    mockNetworkAdapter = {
      fetch: vi.fn(),
      getHeaders: vi.fn(() => ({})),
      setToken: vi.fn(),
    };

    // Setup mock toaster
    mockToaster = vi.fn();

    // Clear all mocks between tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createResonanceClient', () => {
    it('should create a resonance client with processSignals method', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      expect(client).toBeDefined();
      expect(typeof client.processSignals).toBe('function');
    });

    it('should handle empty signals array', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      // Should not throw
      expect(() => client.processSignals([])).not.toThrow();
    });
  });

  describe('Invalidate Signal', () => {
    it('should call queryClient.invalidateQueries for invalidate signals', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const signals: ResonanceSignal[] = [
        { type: 'invalidate', scope: ['demo.tasks.index'] },
      ];

      client.processSignals(signals);

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
      expect(mockRouter.invalidate).toHaveBeenCalled();
    });

    it('should handle multiple scopes in invalidate signal', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const signals: ResonanceSignal[] = [
        { type: 'invalidate', scope: ['demo.tasks.index', 'demo.profile.show', 'user'] },
      ];

      client.processSignals(signals);

      // Should be called once per scope
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(3);
    });

    it('should handle path-based scope (starting with /)', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const signals: ResonanceSignal[] = [
        { type: 'invalidate', scope: ['/demo/tasks'] },
      ];

      client.processSignals(signals);

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
    });
  });

  describe('Redirect Signal', () => {
    it('should navigate on redirect signal', async () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const signals: ResonanceSignal[] = [
        { type: 'redirect', to: '/dashboard' },
      ];

      client.processSignals(signals);

      // Navigation is queued with queueMicrotask, so we need to wait
      await new Promise((resolve) => queueMicrotask(resolve));

      expect(mockRouter.navigate).toHaveBeenCalledWith({
        to: '/dashboard',
        replace: undefined,
      });
    });

    it('should handle redirect with replace option', async () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const signals: ResonanceSignal[] = [
        { type: 'redirect', to: '/login', replace: true },
      ];

      client.processSignals(signals);

      await new Promise((resolve) => queueMicrotask(resolve));

      expect(mockRouter.navigate).toHaveBeenCalledWith({
        to: '/login',
        replace: true,
      });
    });
  });

  describe('Flash Signal', () => {
    it('should call toaster when provided', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
        ui: { toaster: mockToaster },
      });

      const signals: ResonanceSignal[] = [
        { type: 'flash', message: 'Task created!', variant: 'success' },
      ];

      client.processSignals(signals);

      expect(mockToaster).toHaveBeenCalledWith('Task created!', 'success');
    });

    it('should dispatch custom event when no toaster provided', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const eventListener = vi.fn();
      window.addEventListener('resonance:flash', eventListener);

      const signals: ResonanceSignal[] = [
        { type: 'flash', message: 'Error occurred', variant: 'error' },
      ];

      client.processSignals(signals);

      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ message: 'Error occurred', variant: 'error' });

      window.removeEventListener('resonance:flash', eventListener);
    });

    it('should handle all flash variants', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
        ui: { toaster: mockToaster },
      });

      const variants: Array<'success' | 'error' | 'info'> = ['success', 'error', 'info'];

      for (const variant of variants) {
        client.processSignals([{ type: 'flash', message: `Test ${variant}`, variant }]);
        expect(mockToaster).toHaveBeenCalledWith(`Test ${variant}`, variant);
      }
    });
  });

  describe('Event Signal', () => {
    it('should dispatch custom event with payload', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const eventListener = vi.fn();
      window.addEventListener('resonance:task.completed', eventListener);

      const signals: ResonanceSignal[] = [
        { type: 'event', name: 'task.completed', payload: { id: 123, title: 'Test Task' } },
      ];

      client.processSignals(signals);

      expect(eventListener).toHaveBeenCalled();
      const event = eventListener.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toEqual({ id: 123, title: 'Test Task' });

      window.removeEventListener('resonance:task.completed', eventListener);
    });
  });

  describe('Token Signal', () => {
    it('should call setToken on network adapter', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const signals: ResonanceSignal[] = [
        { type: 'token', token: 'new-jwt-token-123' },
      ];

      client.processSignals(signals);

      expect(mockNetworkAdapter.setToken).toHaveBeenCalledWith('new-jwt-token-123');
    });

    it('should handle null token (logout)', () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const signals: ResonanceSignal[] = [
        { type: 'token', token: null },
      ];

      client.processSignals(signals);

      expect(mockNetworkAdapter.setToken).toHaveBeenCalledWith(null);
    });

    it('should not error when network adapter has no setToken', () => {
      const adapterWithoutSetToken: NetworkAdapter = {
        fetch: vi.fn(),
        getHeaders: vi.fn(() => ({})),
      };

      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: adapterWithoutSetToken,
      });

      const signals: ResonanceSignal[] = [
        { type: 'token', token: 'some-token' },
      ];

      expect(() => client.processSignals(signals)).not.toThrow();
    });
  });

  describe('Error/Debug Signal', () => {
    it('should add error to errorStore', async () => {
      const { errorStore } = await import('../../src/js/devtools/ErrorStore');

      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
      });

      const signals: ResonanceSignal[] = [
        {
          type: 'error',
          html: '<div>Error details</div>',
          exception: {
            class: 'RuntimeException',
            message: 'Something went wrong',
            file: '/app/Http/Controllers/TestController.php',
            line: 42,
          },
        },
      ];

      client.processSignals(signals);

      expect(errorStore.add).toHaveBeenCalledWith({
        type: 'error',
        html: '<div>Error details</div>',
        exception: {
          class: 'RuntimeException',
          message: 'Something went wrong',
          file: '/app/Http/Controllers/TestController.php',
          line: 42,
        },
      });
    });

    it('should show error toast for exceptions', async () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
        ui: { toaster: mockToaster },
      });

      const signals: ResonanceSignal[] = [
        {
          type: 'error',
          html: '<div>Exception</div>',
        },
      ];

      client.processSignals(signals);

      expect(mockToaster).toHaveBeenCalledWith('Server error occurred - check devtools', 'error');
    });

    it('should show info toast for debug output', async () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
        ui: { toaster: mockToaster },
      });

      const signals: ResonanceSignal[] = [
        {
          type: 'debug',
          html: '<div class="sf-dump">debug output</div>',
        },
      ];

      client.processSignals(signals);

      expect(mockToaster).toHaveBeenCalledWith('Debug output available in devtools', 'info');
    });
  });

  describe('Multiple Signals', () => {
    it('should process multiple signals in order', async () => {
      const client = createResonanceClient({
        queryClient: mockQueryClient,
        router: mockRouter,
        networkAdapter: mockNetworkAdapter,
        ui: { toaster: mockToaster },
      });

      const signals: ResonanceSignal[] = [
        { type: 'invalidate', scope: ['demo.tasks.index'] },
        { type: 'flash', message: 'Task created!', variant: 'success' },
        { type: 'redirect', to: '/tasks' },
      ];

      client.processSignals(signals);

      // Wait for redirect microtask
      await new Promise((resolve) => queueMicrotask(resolve));

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();
      expect(mockToaster).toHaveBeenCalledWith('Task created!', 'success');
      expect(mockRouter.navigate).toHaveBeenCalledWith({ to: '/tasks', replace: undefined });
    });
  });
});
