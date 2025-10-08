import { NextApiRequest, NextApiResponse } from 'next';
import { applyOptimizedConfig } from '@/lib/services/optimizerService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'Missing jobId' });
    }

    const result = await applyOptimizedConfig(jobId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error applying optimized config:', error);
    return res.status(500).json({ 
      error: 'Failed to apply optimized configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
