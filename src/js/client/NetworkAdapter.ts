import type { AuthConfig } from '../createResonanceApp';
import type { ResonanceEnvelope, ValidationErrors } from '../types/envelope';

export class ResonanceValidationError extends Error {
  constructor(
    public errors: ValidationErrors,
    public status: number = 422
  ) {
    super('Validation failed');
    this.name = 'ResonanceValidationError';
  }
}

export class ResonanceAuthError extends Error {
  constructor(
    public status: number,
    message: string = 'Authentication required'
  ) {
    super(message);
    this.name = 'ResonanceAuthError';
  }
}

export interface NetworkAdapter {
  fetch<T>(url: string, options?: RequestInit): Promise<ResonanceEnvelope<T>>;
  getHeaders(): HeadersInit;
  setToken?: (token: string | null) => void;
}

export type NavigateCallback = (to: string, options?: { replace?: boolean }) => void;

export function createNetworkAdapter(
  authConfig: AuthConfig,
  baseUrl: string = '/api',
  onNavigate: NavigateCallback,
  loginUrl: string = '/login'
): NetworkAdapter {
  if (authConfig.driver === 'cookie') {
    return createCookieAdapter(baseUrl, onNavigate, loginUrl, authConfig.csrfEndpoint);
  }
  return createSanctumTokenAdapter(baseUrl, onNavigate, loginUrl, authConfig.tokenStorage ?? 'localStorage');
}

function createCookieAdapter(
  baseUrl: string,
  onNavigate: NavigateCallback,
  loginUrl: string,
  csrfEndpoint?: string
): NetworkAdapter {
  const getCsrfFromCookie = (): string | null => {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  const ensureCsrfToken = async (): Promise<void> => {
    if (getCsrfFromCookie()) return;
    const endpoint = csrfEndpoint ?? '/sanctum/csrf-cookie';
    await fetch(endpoint, { credentials: 'include' });
  };

  const getHeaders = (): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };

    const xsrfToken = getCsrfFromCookie();
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    return headers;
  };

  return {
    getHeaders,

    async fetch<T>(url: string, options: RequestInit = {}): Promise<ResonanceEnvelope<T>> {
      if (options.method && options.method !== 'GET') {
        await ensureCsrfToken();
      }

      const response = await fetch(`${baseUrl}${url}`, {
        ...options,
        credentials: 'include',
        headers: {
          ...getHeaders(),
          ...options.headers,
        },
      });

      if (response.status === 422) {
        const errorData = await response.json();
        console.error('[NetworkAdapter] Validation error:', {
          url,
          status: response.status,
          errors: errorData.errors ?? errorData,
        });
        throw new ResonanceValidationError(errorData.errors ?? errorData);
      }

      if (response.status === 401 || response.status === 419) {
        console.warn('[NetworkAdapter] Authentication error, redirecting to login:', {
          url,
          status: response.status,
          loginUrl,
        });
        onNavigate(loginUrl, { replace: true });
        throw new ResonanceAuthError(response.status, 'Session expired');
      }

      if (!response.ok) {
        console.error('[NetworkAdapter] Request failed:', {
          url,
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      return JSON.parse(text);
    },
  };
}

function createSanctumTokenAdapter(
  baseUrl: string,
  onNavigate: NavigateCallback,
  loginUrl: string,
  tokenStorage: 'localStorage' | 'memory'
): NetworkAdapter {
  let token: string | null = tokenStorage === 'localStorage'
    ? localStorage.getItem('resonance_token')
    : null;

  const setToken = (newToken: string | null): void => {
    token = newToken;
    if (tokenStorage === 'localStorage') {
      if (newToken) {
        localStorage.setItem('resonance_token', newToken);
      } else {
        localStorage.removeItem('resonance_token');
      }
    }
  };

  const getHeaders = (): HeadersInit => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  };

  return {
    getHeaders,
    setToken,

    async fetch<T>(url: string, options: RequestInit = {}): Promise<ResonanceEnvelope<T>> {
      const response = await fetch(`${baseUrl}${url}`, {
        ...options,
        headers: {
          ...getHeaders(),
          ...options.headers,
        },
      });

      if (response.status === 422) {
        const errorData = await response.json();
        console.error('[NetworkAdapter Token] Validation error:', {
          url,
          status: response.status,
          errors: errorData.errors ?? errorData,
        });
        throw new ResonanceValidationError(errorData.errors ?? errorData);
      }

      if (response.status === 401) {
        console.warn('[NetworkAdapter Token] Authentication error, redirecting to login:', {
          url,
          status: response.status,
          loginUrl,
        });
        setToken(null);
        onNavigate(loginUrl, { replace: true });
        throw new ResonanceAuthError(401);
      }

      if (!response.ok) {
        console.error('[NetworkAdapter Token] Request failed:', {
          url,
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      return JSON.parse(text);
    },
  };
}
