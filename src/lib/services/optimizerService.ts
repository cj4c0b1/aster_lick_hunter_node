/**
 * Optimizer Service
 * 
 * Client-safe wrapper for the optimizer service.
 * The actual implementation is in the server-side module.
 * 
 * Note: This file should only be imported in server components or API routes.
 * Use the `useOptimizer` hook in client components.
 */

// Export types only for client-side usage
export type {
  OptimizationJob,
  OptimizationConfig,
  OptimizationResults,
  SymbolRecommendation,
} from './server/optimizerService.server';

// These functions will only work on the server side
// They will throw an error if called from the client

// Server-side implementation
const serverFunctions = {
  startOptimization: async (config: any) => {
    if (typeof window !== 'undefined') {
      throw new Error('startOptimization can only be called on the server side');
    }
    const optimizerServer = await import('./server/optimizerService.server');
    return optimizerServer.startOptimization(config);
  },
  
  getJobStatus: async (jobId: string) => {
    if (typeof window !== 'undefined') {
      throw new Error('getJobStatus can only be called on the server side');
    }
    const optimizerServer = await import('./server/optimizerService.server');
    return optimizerServer.getJobStatus(jobId);
  },
  
  cancelJob: async (jobId: string) => {
    if (typeof window !== 'undefined') {
      throw new Error('cancelJob can only be called on the server side');
    }
    const optimizerServer = await import('./server/optimizerService.server');
    return optimizerServer.cancelJob(jobId);
  },
  
  applyOptimizedConfig: async (jobId: string) => {
    if (typeof window !== 'undefined') {
      throw new Error('applyOptimizedConfig can only be called on the server side');
    }
    const optimizerServer = await import('./server/optimizerService.server');
    return optimizerServer.applyOptimizedConfig(jobId);
  },
  
  cleanupOldJobs: async (maxAgeMs?: number) => {
    if (typeof window !== 'undefined') {
      throw new Error('cleanupOldJobs can only be called on the server side');
    }
    const optimizerServer = await import('./server/optimizerService.server');
    return optimizerServer.cleanupOldJobs(maxAgeMs);
  },
  
  resetOptimizerState: async () => {
    if (typeof window !== 'undefined') {
      throw new Error('resetOptimizerState can only be called on the server side');
    }
    const optimizerServer = await import('./server/optimizerService.server');
    return optimizerServer.resetOptimizerState();
  }
};

// Export all functions
export const {
  startOptimization,
  getJobStatus,
  cancelJob,
  applyOptimizedConfig,
  cleanupOldJobs,
  resetOptimizerState
} = serverFunctions;
