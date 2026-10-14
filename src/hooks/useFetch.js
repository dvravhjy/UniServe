import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../services/api';

// Load data from an endpoint; returns { data, loading, error, reload }.
// Pass a falsy url to skip fetching (e.g. until the user picks something).
export default function useFetch(url, initial = null) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      setData((await api.get(url)).data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}
