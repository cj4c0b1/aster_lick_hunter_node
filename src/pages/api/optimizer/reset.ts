import { NextApiRequest, NextApiResponse } from 'next';
import { resetOptimizerState } from '@/lib/services/optimizerService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await resetOptimizerState();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error resetting optimizer state:', error);
    return res.status(500).json({ 
      error: 'Failed to reset optimizer state',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
