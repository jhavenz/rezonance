export type InvalidateSignal = {
  type: 'invalidate';
  scope: string[];
};

export type RedirectSignal = {
  type: 'redirect';
  to: string;
  replace?: boolean;
};

export type FlashSignal = {
  type: 'flash';
  message: string;
  variant: 'success' | 'error' | 'info';
};

export type EventSignal = {
  type: 'event';
  name: string;
  payload: unknown;
};

export type ErrorSignal = {
  type: 'error';
  html: string;
  exception?: {
    class: string;
    message: string;
    file: string;
    line: number;
  };
};

export type DebugSignal = {
  type: 'debug';
  html: string;
};

export type TokenSignal = {
  type: 'token';
  token: string | null;
};

export type ResonanceSignal =
  | InvalidateSignal
  | RedirectSignal
  | FlashSignal
  | EventSignal
  | ErrorSignal
  | DebugSignal
  | TokenSignal;

export type ResonanceEnvelope<T> = {
  data: T;
  meta: {
    signals: ResonanceSignal[];
    timestamp: number;
    trace_id: string;
  };
};

export type ValidationErrors = Record<string, string[]>;
