import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobStatus } from '@/lib/services/optimizerService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId || Array.isArray(jobId)) {
    return res.status(400).json({ error: 'Missing or invalid jobId' });
  }

  try {
    const status = await getJobStatus(jobId);
    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }
    return res.status(200).json(status);
  } catch (error) {
    console.error('Error fetching optimizer status:', error);
    return res.status(500).json({ error: 'Failed to fetch optimizer status' });
  }
}
