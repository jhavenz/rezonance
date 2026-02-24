import { useEffect, useState } from 'react';
import { errorStore } from '../ErrorStore';
import type { ErrorEntry } from '../types';

export function useErrorStore() {
  const [errors, setErrors] = useState<ErrorEntry[]>(errorStore.getAll());

  useEffect(() => {
    const unsubscribe = errorStore.subscribe(setErrors);
    return unsubscribe;
  }, []);

  return errors;
}

export function useUnreadErrorCount() {
  const errors = useErrorStore();
  return errors.filter((e) => !e.read).length;
}
