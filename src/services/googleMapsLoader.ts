import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

let loaderPromise: Promise<any> | null = null;
let currentKeyLoaded: string | null = null;
let authFailureCallback: ((msg: string) => void) | null = null;

// Register global Google Maps auth failure handler
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    const errorMsg =
      'Google Maps authentication failed: The provided API key is invalid, lacks Maps JavaScript API permissions, or is restricted by HTTP referrer.';
    console.warn(errorMsg);
    if (authFailureCallback) {
      authFailureCallback(errorMsg);
    }
  };
}

export function setMapsAuthFailureListener(callback: ((msg: string) => void) | null) {
  authFailureCallback = callback;
}

export function loadGoogleMaps(apiKey: string): Promise<any> {
  // If window.google?.maps is already available, resolve immediately
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }

  // If already loading with the same key, return the existing promise
  if (loaderPromise && currentKeyLoaded === apiKey) {
    return loaderPromise;
  }

  currentKeyLoaded = apiKey;
  loaderPromise = (async () => {
    try {
      setOptions({
        key: apiKey,
        v: 'weekly',
      });
      await importLibrary('maps');
      return (window as any).google;
    } catch (err: any) {
      // Reset promise if loading failed so a user can supply an updated key
      loaderPromise = null;
      throw err;
    }
  })();

  return loaderPromise;
}
