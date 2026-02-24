import { useCallback, useRef, useState } from 'react';

interface UseEventStreamOptions {
  onText?: (text: string) => void;
  onEvent?: (type: string, data: any) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
  enabled?: boolean;
}

interface SSEEvent {
  type: string;
  data: any;
}

function parseSSE(raw: string): SSEEvent {
  const lines = raw.split('\n');
  let eventType = '';
  let eventData = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      eventData = line.slice(6);
    }
  }

  let data: any = {};
  if (eventData) {
    try {
      data = JSON.parse(eventData);
    } catch {
      data = { raw: eventData };
    }
  }

  return { type: eventType, data };
}

export function useEventStream(url: string | null, options: UseEventStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (body?: any) => {
      if (!url) return;

      setIsStreaming(true);
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
          credentials: 'include',
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const eventRaw of events) {
            if (!eventRaw.trim()) continue;

            const { type, data } = parseSSE(eventRaw);

            if (type === 'text') {
              options.onText?.(data.text);
            } else if (type === 'done') {
              options.onDone?.();
              setIsStreaming(false);
              return;
            } else if (type === 'error') {
              options.onError?.(data.error || 'Unknown error');
              setIsStreaming(false);
              return;
            } else if (type) {
              options.onEvent?.(type, data);
            }
          }
        }

        // Stream ended without explicit done event
        options.onDone?.();
        setIsStreaming(false);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          options.onError?.(error.message || 'Stream error');
        }
        setIsStreaming(false);
      }
    },
    [url, options]
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { start, abort, isStreaming };
}
