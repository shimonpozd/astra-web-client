import { useEffect, useState } from 'react';
import { api, ProfileResponse } from '@/services/api';

export function useProfile(slug?: string) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    api
      .getProfile(slug)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || 'Не удалось загрузить профиль');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { profile, isLoading, error };
}
