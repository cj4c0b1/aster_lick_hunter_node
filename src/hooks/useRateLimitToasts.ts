/**
 * Hook to handle rate limit toast notifications from WebSocket
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import websocketService from '@/lib/services/websocketService';

interface RateLimitToast {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface ToastMessage {
  type: string;
  data: RateLimitToast;
}

export function useRateLimitToasts() {
  const displayedToasts = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleMessage = (message: ToastMessage) => {
      if (message.type === 'toast' && message.data) {
        const toastData = message.data;

        // Create a unique key for this toast to avoid duplicates
        const toastKey = `${toastData.type}-${toastData.title}-${Date.now()}`;

        // Skip if we've recently shown this exact toast
        if (displayedToasts.current.has(toastKey)) {
          return;
        }

        displayedToasts.current.add(toastKey);

        // Remove from set after a delay to allow future similar toasts
        setTimeout(() => {
          displayedToasts.current.delete(toastKey);
        }, 2000);

        // Display the toast based on type
        switch (toastData.type) {
          case 'success':
            toast.success(toastData.title, {
              description: toastData.message,
              duration: toastData.duration || 4000,
            });
            break;

          case 'error':
            toast.error(toastData.title, {
              description: toastData.message,
              duration: toastData.duration || 10000,
            });
            break;

          case 'warning':
            toast.warning(toastData.title, {
              description: toastData.message,
              duration: toastData.duration || 8000,
            });
            break;

          case 'info':
          default:
            toast.info(toastData.title, {
              description: toastData.message,
              duration: toastData.duration || 5000,
            });
            break;
        }
      }
    };

    // Add WebSocket message handler
    const cleanup = websocketService.addMessageHandler(handleMessage);

    return cleanup;
  }, []);

  return null;
}

/**
 * Component to initialize rate limit toast listener
 * Add this to your main layout or dashboard
 */
export function RateLimitToastListener() {
  useRateLimitToasts();
  return null;
}