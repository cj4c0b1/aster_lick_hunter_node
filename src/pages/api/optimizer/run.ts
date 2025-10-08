import { NextApiRequest, NextApiResponse } from 'next';
import { startOptimization } from '@/lib/services/optimizerService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { weights, capitalAllocation, symbols } = req.body;

    if (!weights) {
      return res.status(400).json({ error: 'Missing required parameter: weights' });
    }

    // Ensure the function is called with all required parameters
    const optimizationConfig = {
      weights: {
        pnl: weights.pnl || 0,
        sharpe: weights.sharpe || 0,
        drawdown: weights.drawdown || 0,
      },
      capitalAllocation,
      symbols
    };

    const result = await startOptimization(optimizationConfig);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error starting optimization:', error);
    return res.status(500).json({ 
      error: 'Failed to start optimization',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
