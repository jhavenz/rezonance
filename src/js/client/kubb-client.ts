import type { ResonanceEnvelope, ResonanceSignal } from '../types/envelope';
import { errorStore } from '../devtools/ErrorStore';

export type RequestConfig<TData = unknown> = {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ResponseConfig<TData = unknown> = {
  data: TData;
  status: number;
  statusText: string;
};

export type ResponseErrorConfig<TError = unknown> = {
  status: number;
  statusText: string;
  data?: TError;
};

let baseUrl = '/api';

function getXsrfToken(): string | null {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

let getHeaders: () => HeadersInit = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const xsrfToken = getXsrfToken();
  if (xsrfToken) {
    headers['X-XSRF-TOKEN'] = xsrfToken;
  }
  return headers;
};

let signalProcessor: ((signals: ResonanceSignal[]) => void) | null = null;

export function configureClient(options: {
  baseUrl?: string;
  getHeaders?: () => HeadersInit;
  signalProcessor?: (signals: ResonanceSignal[]) => void;
}) {
  if (options.baseUrl) baseUrl = options.baseUrl;
  if (options.getHeaders) getHeaders = options.getHeaders;
  if (options.signalProcessor) signalProcessor = options.signalProcessor;
}

export async function client<TData = unknown>(
  config: RequestConfig<TData>
): Promise<ResponseConfig<TData>> {
  const { url, method = 'GET', params, data, headers, signal } = config;

  let fullUrl = `${baseUrl}${url}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }

  // When sending FormData, let the browser set Content-Type automatically
  const requestHeaders: Record<string, string> = { ...getHeaders(), ...headers };
  if (data instanceof FormData) {
    delete requestHeaders['Content-Type'];
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: 'include',
    signal,
  };

  let response = await fetch(fullUrl, requestOptions);

  // Handle CSRF token expiration (419) - refresh token and retry once
  if (response.status === 419) {
    await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
    // Rebuild request options with fresh CSRF token from cookie
    const retryHeaders: Record<string, string> = { ...getHeaders(), ...headers };
    if (data instanceof FormData) {
      delete retryHeaders['Content-Type'];
    }

    const retryOptions: RequestInit = {
      method,
      headers: retryHeaders,
      body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
      credentials: 'include',
      signal,
    };
    response = await fetch(fullUrl, retryOptions);
  }

  if (!response.ok) {
    // Try to parse as JSON first
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    // If we got HTML (from dd(), dump(), or serialization error), add to error store
    if (isHtml && response.status >= 500) {
      const html = await response.text();
      console.warn('[Resonance Client] Received HTML error response (likely dd/dump output)');

      // Add to error store
      errorStore.add({
        type: 'error',
        html,
        exception: {
          class: 'HTML Error Response',
          message: `Server returned HTML for ${method} ${url}`,
          file: url,
          line: response.status,
        },
      });

      const error = new Error(`Request failed: ${response.status} ${response.statusText}`) as Error & {
        status: number;
        data: unknown;
      };
      error.status = response.status;
      error.data = { html };
      throw error;
    }

    // Try to parse JSON
    const errorData = await response.json().catch((parseError) => {
      console.warn('[Resonance Client] Failed to parse error response as JSON:', parseError);
      return null;
    });

    // Process signals from error responses (e.g., flash messages for 401)
    if (signalProcessor && errorData?.meta?.signals?.length) {
      signalProcessor(errorData.meta.signals);
    }

    const error = new Error(`Request failed: ${response.status} ${response.statusText}`) as Error & {
      status: number;
      data: unknown;
    };
    error.status = response.status;
    // Extract data from envelope if present, otherwise use raw error
    error.data = errorData?.data !== undefined ? errorData.data : errorData;

    console.error('[Resonance Client] Request failed:', {
      method,
      url: fullUrl,
      status: response.status,
      statusText: response.statusText,
      errorData: error.data,
    });

    throw error;
  }

  const json = await response.json().catch((parseError) => {
    console.error('[Resonance Client] Failed to parse successful response as JSON:', {
      method,
      url: fullUrl,
      status: response.status,
      parseError,
    });
    throw parseError;
  }) as ResonanceEnvelope<TData>;

  // Process signals for mutations (POST, PUT, PATCH, DELETE)
  const isMutation = method !== 'GET';
  if (isMutation && signalProcessor && json.meta?.signals?.length) {
    signalProcessor(json.meta.signals);
  }

  return {
    data: json.data,
    status: response.status,
    statusText: response.statusText,
  };
}

export default client;
