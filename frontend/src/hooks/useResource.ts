import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
export function useResource<T>(path: string) {
  const [value, setValue] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await api<T>(path);
      if (generation.current === version) setValue(result);
    } catch (e) {
      if (generation.current === version)
        setError(e instanceof Error ? e.message : 'Unable to load data');
    } finally {
      if (generation.current === version) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setValue(null);
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  return { value, loading, error, reload };
}
