'use client';

import React, { useState } from 'react';

interface BotControlsProps {
  onStart: () => void;
  onStop: () => void;
  isRunning: boolean;
}

export default function BotControls({ onStart, onStop, isRunning }: BotControlsProps) {
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'stopping'>('idle');

  const handleStart = async () => {
    setStatus('starting');
    try {
      onStart();
      setStatus('running');
    } catch (error) {
      console.error('Failed to start bot:', error);
      setStatus('idle');
    }
  };

  const handleStop = async () => {
    setStatus('stopping');
    try {
      onStop();
      setStatus('idle');
    } catch (error) {
      console.error('Failed to stop bot:', error);
      setStatus('running');
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">Bot Controls</h3>

      <div className="flex gap-4 items-center mb-4">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={status === 'starting'}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {status === 'starting' ? 'Starting...' : 'Start Bot'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={status === 'stopping'}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {status === 'stopping' ? 'Stopping...' : 'Stop Bot'}
          </button>
        )}

        <div className={`px-3 py-1 rounded-full text-sm ${
          status === 'running' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          Status: {status}
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <p>💡 The bot will run as a local process. Ensure config.json is properly set up before starting.</p>
        <p>🚨 In paper mode, no real trades will be placed. Switch off for live trading.</p>
      </div>
    </div>
  );
}
