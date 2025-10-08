'use client';

import { toast } from 'sonner';

interface OptimizerConfig {
  weights: {
    pnl: number;
    sharpe: number;
    drawdown: number;
  };
  capitalAllocation?: number;
  symbols?: string[];
}

interface OptimizerJob {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStage: string;
  startTime: number;
  estimatedTimeRemaining?: number;
  results?: any;
  error?: string;
  config: OptimizerConfig;
}

class OptimizerClient {
  private baseUrl = '/api/optimizer';

  async startOptimization(config: OptimizerConfig): Promise<{ jobId: string }> {
    const response = await fetch(`${this.baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to start optimization');
    }

    return response.json();
  }

  private async fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) { // Rate limited
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.fetchWithRetry(url, options, retries - 1, delay * 2);
        }
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<OptimizerJob> {
    try {
      const response = await this.fetchWithRetry(
        `${this.baseUrl}/status?jobId=${encodeURIComponent(jobId)}`,
        { credentials: 'same-origin' }
      );
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error('Job not found. The job may have expired or the server may have restarted.');
        }
        throw new Error(error.error || `Failed to fetch job status (${response.status})`);
      }

      return response.json();
    } catch (error) {
      console.error('Error in getJobStatus:', error);
      throw error instanceof Error ? error : new Error('Network error while fetching job status');
    }
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to cancel job');
    }

    return response.json();
  }

  async applyOptimizedConfig(jobId: string): Promise<{ success: boolean; backupPath?: string }> {
    const response = await fetch(`${this.baseUrl}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to apply optimized configuration');
    }

    return response.json();
  }

  async resetOptimizerState(): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/reset`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to reset optimizer state');
    }

    return response.json();
  }
}

export const optimizerClient = new OptimizerClient();
