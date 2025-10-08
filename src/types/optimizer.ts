export type OptimizerJobStatus = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  startedAt: string; // ISO date string
  updatedAt: string; // ISO date string
  result?: any; // Result data when job is completed
  error?: string; // Error message if job failed
};
