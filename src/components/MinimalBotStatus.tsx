'use client';

import React from 'react';
import { Circle } from 'lucide-react';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useWebSocketUrl } from '@/hooks/useWebSocketUrl';

export default function MinimalBotStatus() {
  const wsUrl = useWebSocketUrl();
  const { status, isConnected } = useBotStatus(wsUrl || undefined);

  const getStatusColor = () => {
    if (!isConnected) return 'bg-red-500';
    if (!status?.isRunning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isConnected) return 'Disconnected';
    if (!status?.isRunning) return 'Connected';
    return 'Running';
  };

  return null;
}