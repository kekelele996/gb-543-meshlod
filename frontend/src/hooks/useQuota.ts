import { useEffect } from 'react';
import { getQuota } from '../api/quota';
import { useQuotaStore } from '../stores/quotaStore';

export function useQuota() {
  const { quota, setQuota, remaining, canStartRun } = useQuotaStore();

  useEffect(() => {
    let cancelled = false;
    getQuota()
      .then((value) => {
        if (!cancelled) setQuota(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [setQuota]);

  const reload = async () => {
    const value = await getQuota();
    setQuota(value);
    return value;
  };

  return { quota, reload, remaining, canStartRun };
}
