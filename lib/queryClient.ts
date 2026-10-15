import { QueryClient } from '@tanstack/react-query';
import { APP_CONFIG } from '../constants';
import { showErrorToast } from './toast';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: APP_CONFIG.staleTime,
      gcTime: APP_CONFIG.gcTime,
      retry: APP_CONFIG.retryCount,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Global error handler for unhandled query errors.
// Screens can define their own onError handlers to show more specific messages.
// This fallback only fires when no local handler is present.
queryClient.getQueryCache().config.onError = (error) => {
  console.error('[QueryCache] Unhandled query error:', error);
  if (!(error instanceof Error)) return;

  const msg = error.message.toLowerCase();
  // Silent errors: network, auth (401/403), and "not found" (404) are expected
  const isSilentError =
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('fetch') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('404') ||
    msg.includes('jwt');

  if (!isSilentError) {
    showErrorToast('Daten konnten nicht geladen werden.');
  }
};
