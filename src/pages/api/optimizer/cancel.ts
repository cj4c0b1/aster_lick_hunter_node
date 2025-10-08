import { NextApiRequest, NextApiResponse } from 'next';
import { cancelJob } from '@/lib/services/optimizerService';

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

    const result = await cancelJob(jobId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error canceling job:', error);
    return res.status(500).json({ 
      error: 'Failed to cancel job',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
