import { getJobStatus } from '@/lib/services/optimizerService';
import type { OptimizationJob as OptimizerJob } from '@/lib/services/optimizerService';

// Re-export the job status type for backward compatibility
export type { OptimizerJob as OptimizerJobStatus };

/**
 * Get the status of an optimizer job
 */
export async function getOptimizerJobStatus(jobId: string): Promise<OptimizerJob | null> {
  return getJobStatus(jobId);
}

/**
 * Update the status of an optimizer job
 * @returns The updated job status
 * @deprecated Use the functions in optimizerService.server.ts directly
 */
export function updateOptimizerJobStatus(jobId: string, status: Partial<OptimizerJob>): OptimizerJob | null {
  console.warn('updateOptimizerJobStatus is deprecated. Use the functions in optimizerService.server.ts directly.');
  const currentStatus = getJobStatus(jobId);
  if (!currentStatus) return null;
  
  // This won't actually update the job status since we're not exporting the update function
  // This is just for backward compatibility
  return {
    ...currentStatus,
    ...status,
    updatedAt: Date.now(),
  };
}

/**
 * Remove a completed or failed job
 * @deprecated Jobs are managed by optimizerService.server.ts
 */
export function removeOptimizerJob(jobId: string): void {
  console.warn('removeOptimizerJob is deprecated. Jobs are managed by optimizerService.server.ts');
  // No-op since we're using the storage from optimizerService.server.ts
}
