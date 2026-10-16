import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { loadGoogleMaps, setMapsAuthFailureListener } from '../services/googleMapsLoader';

const LOCAL_STORAGE_KEY = 'hazelens.mapsBrowserKey';

export interface GoogleMapsContextType {
  browserKey: string | null;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  google: any;
}

const GoogleMapsContext = createContext<GoogleMapsContextType | null>(null);

// Module-level cache so we never re-fetch /api/public-config across re-renders
let cachedServerKey: string | null = null;
let publicConfigFetchPromise: Promise<string | null> | null = null;

async function fetchPublicConfigKey(): Promise<string | null> {
  if (cachedServerKey) return cachedServerKey;
  if (!publicConfigFetchPromise) {
    publicConfigFetchPromise = (async () => {
      try {
        const res = await fetch('/api/public-config');
        if (res.ok) {
          const data = await res.json();
          if (
            data?.googleMapsBrowserKey &&
            typeof data.googleMapsBrowserKey === 'string' &&
            data.googleMapsBrowserKey.trim()
          ) {
            cachedServerKey = data.googleMapsBrowserKey.trim();
            return cachedServerKey;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch /api/public-config:', err);
      }
      return null;
    })();
  }
  return publicConfigFetchPromise;
}

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [browserKey, setBrowserKey] = useState<string | null>(cachedServerKey);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [googleInstance, setGoogleInstance] = useState<any>(null);

  // Hook into gm_authFailure for runtime restriction or key authorization failures
  useEffect(() => {
    setMapsAuthFailureListener((msg) => {
      console.warn('Maps Auth Failure:', msg);
      setError('Google Maps is temporarily unavailable.');
      setIsLoaded(false);
    });

    return () => {
      setMapsAuthFailureListener(null);
    };
  }, []);

  const initializeWithKey = useCallback(async (key: string): Promise<boolean> => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Google Maps is temporarily unavailable.');
      setIsLoading(false);
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const g = await loadGoogleMaps(trimmed);
      setBrowserKey(trimmed);
      setGoogleInstance(g);
      setIsLoaded(true);
      setError(null);
      return true;
    } catch (err: any) {
      console.error('Failed to load Google Maps:', err);
      setError('Google Maps is temporarily unavailable.');
      setIsLoaded(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Application startup resolution:
  // 1. Primary: Server-side public config endpoint /api/public-config (reads GOOGLE_MAPS_BROWSER_KEY)
  // 2. Client env var fallback: import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY
  // 3. Optional local storage developer fallback
  // 4. If none found, show non-blocking notice "Google Maps is temporarily unavailable."
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).google?.maps) {
      setGoogleInstance((window as any).google);
      setIsLoaded(true);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function initializeMaps() {
      setIsLoading(true);

      // 1. Primary: Server-side public config endpoint
      const serverKey = await fetchPublicConfigKey();
      if (serverKey && isMounted) {
        await initializeWithKey(serverKey);
        return;
      }

      // 2. Environment variable fallback
      const envKey =
        (import.meta as any).env?.VITE_GOOGLE_MAPS_BROWSER_KEY ||
        (import.meta as any).env?.GOOGLE_MAPS_BROWSER_KEY;

      if (envKey && typeof envKey === 'string' && envKey.trim().length > 0 && isMounted) {
        await initializeWithKey(envKey.trim());
        return;
      }

      // 3. Optional developer fallback from localStorage
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored && stored.trim().length > 0 && isMounted) {
          await initializeWithKey(stored.trim());
          return;
        }
      } catch (e) {
        // Ignore localStorage error
      }

      // 4. No key found: non-blocking warning without user prompt
      if (isMounted) {
        setIsLoading(false);
        setError('Google Maps is temporarily unavailable.');
      }
    }

    initializeMaps();

    return () => {
      isMounted = false;
    };
  }, [initializeWithKey]);

  return (
    <GoogleMapsContext.Provider
      value={{
        browserKey,
        isLoaded,
        isLoading,
        error,
        google: googleInstance,
      }}
    >
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext);
  if (!context) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
}
