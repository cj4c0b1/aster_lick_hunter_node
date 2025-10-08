'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { optimizerClient } from '@/lib/api/optimizerClient';

interface OptimizerProgressBarProps {
  jobId: string;
  onComplete: (results: any) => void;
  onCancel: () => void;
  onError: (error: string) => void;
  variant?: 'full' | 'inline';
  onProgressUpdate?: (progress: number) => void;
}

/**
 * OptimizerProgressBar Component
 *
 * Real-time progress tracking with 5-second polling
 * Shows elapsed time, estimated remaining time, and current stage
 */
export function OptimizerProgressBar({
  jobId,
  onComplete,
  onCancel,
  onError,
  variant: _variant = 'full',
  onProgressUpdate,
}: OptimizerProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Initializing...');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isErrored, setIsErrored] = useState(false);

  // Polling implementation
  const [jobNotFound, setJobNotFound] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!jobId) return;
    
    let intervalId: NodeJS.Timeout | null = null;
    let stopped = false;
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;

    const pollStatus = async () => {
      if (stopped) return;

      try {
        const job = await optimizerClient.getJobStatus(jobId);
        consecutiveErrors = 0; // Reset error counter on successful fetch
        
        // Update local state directly
        setProgress(job.progress);
        setCurrentStage(job.currentStage);
        setElapsedTime((Date.now() - job.startTime) / 1000); // Convert to seconds
        
        if (job.estimatedTimeRemaining !== undefined) {
          setEstimatedTimeRemaining(job.estimatedTimeRemaining);
        }

        if (onProgressUpdate) {
          onProgressUpdate(job.progress);
        }

        if (job.status === 'completed') {
          onComplete(job.results || {});
          stopped = true;
        } else if (job.status === 'failed') {
          setIsErrored(true);
          onError(job.error || 'Optimization failed');
          stopped = true;
        } else if (job.status === 'cancelled') {
          onCancel();
          stopped = true;
        }
      } catch (err) {
        console.error('Error polling optimization status:', err);
        if (!stopped) {
          setIsErrored(true);
          onError(err instanceof Error ? err.message : 'Failed to check status');
          stopped = true;
        }
      }
    };

    // Initial poll
    pollStatus();
    
    // Set up interval for polling
    intervalId = setInterval(pollStatus, 5000);

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, onComplete, onCancel, onError, onProgressUpdate]);

  const handleOptimizationCancel = useCallback(async () => {
    if (!jobId) return;

    setIsCancelling(true);

    try {
      const response = await fetch(`/api/optimizer/cancel?jobId=${jobId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel optimization');
      }

      setIsCancelling(false);
      onCancel();
    } catch (error) {
      console.error('Error cancelling optimization:', error);
      setIsCancelling(false);
      setIsErrored(true);
      onError(error instanceof Error ? error.message : 'Failed to cancel optimization');
    }
  }, [jobId, onCancel, onError]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (isErrored) {
    return (
      <div className="flex items-center space-x-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <span>Optimization failed</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{currentStage}</div>
        <div className="text-xs text-muted-foreground">
          {formatTime(elapsedTime)}
          {estimatedTimeRemaining !== null && ` • ${formatTime(estimatedTimeRemaining)} left`}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="text-xs font-medium w-10 text-right">{Math.round(progress)}%</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleOptimizationCancel}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
          <span className="sr-only">Cancel optimization</span>
        </Button>
      </div>

      {/* Warning */}
      <div className="text-center text-xs text-muted-foreground">
        Keep this page open during optimization
      </div>
    </div>
  );
}
