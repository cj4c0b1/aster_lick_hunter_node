'use client';

import React, { useState } from 'react';

interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  pnlPercent: number;
  margin: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
}

interface PositionTableProps {
  positions?: Position[];
  onClosePosition?: (symbol: string, side: 'LONG' | 'SHORT') => void;
  onUpdateSL?: (symbol: string, side: 'LONG' | 'SHORT', price: number) => void;
  onUpdateTP?: (symbol: string, side: 'LONG' | 'SHORT', price: number) => void;
}

export default function PositionTable({
  positions = [],
  onClosePosition,
  onUpdateSL,
  onUpdateTP,
}: PositionTableProps) {
  const [editingSL, setEditingSL] = useState<string | null>(null);
  const [editingTP, setEditingTP] = useState<string | null>(null);
  const [tempSL, setTempSL] = useState<number>(0);
  const [tempTP, setTempTP] = useState<number>(0);

  // Mock data for demonstration
  const mockPositions: Position[] = positions.length > 0 ? positions : [
    {
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 0.1,
      entryPrice: 42000,
      markPrice: 42500,
      pnl: 50,
      pnlPercent: 1.19,
      margin: 420,
      stopLoss: 41160,
      takeProfit: 43260,
      leverage: 10,
    },
    {
      symbol: 'ETHUSDT',
      side: 'SHORT',
      quantity: 1,
      entryPrice: 2200,
      markPrice: 2190,
      pnl: 10,
      pnlPercent: 0.45,
      margin: 220,
      stopLoss: 2244,
      takeProfit: 2134,
      leverage: 10,
    },
  ];

  const displayPositions = positions.length > 0 ? positions : mockPositions;

  const getPnLColor = (pnl: number): string => {
    if (pnl > 0) return 'text-green-600';
    if (pnl < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getSideColor = (side: 'LONG' | 'SHORT'): string => {
    return side === 'LONG' ? 'text-green-600' : 'text-red-600';
  };

  const getSideBgColor = (side: 'LONG' | 'SHORT'): string => {
    return side === 'LONG' ? 'bg-green-50' : 'bg-red-50';
  };

  const handleSLEdit = (position: Position) => {
    const key = `${position.symbol}-${position.side}`;
    setEditingSL(key);
    setTempSL(position.stopLoss || 0);
  };

  const handleTPEdit = (position: Position) => {
    const key = `${position.symbol}-${position.side}`;
    setEditingTP(key);
    setTempTP(position.takeProfit || 0);
  };

  const saveSL = (position: Position) => {
    if (onUpdateSL && tempSL > 0) {
      onUpdateSL(position.symbol, position.side, tempSL);
    }
    setEditingSL(null);
  };

  const saveTP = (position: Position) => {
    if (onUpdateTP && tempTP > 0) {
      onUpdateTP(position.symbol, position.side, tempTP);
    }
    setEditingTP(null);
  };

  const totalPnL = displayPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalMargin = displayPositions.reduce((sum, p) => sum + p.margin, 0);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Open Positions</h2>
          <div className="flex gap-4 text-sm">
            <span>Total Margin: <span className="font-semibold">${totalMargin.toFixed(2)}</span></span>
            <span>Total PnL: <span className={`font-semibold ${getPnLColor(totalPnL)}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </span></span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Symbol</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Side</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Size</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Entry</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Mark</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">PnL</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Margin</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">SL</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">TP</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayPositions.map((position) => {
              const key = `${position.symbol}-${position.side}`;
              return (
                <tr key={key} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{position.symbol}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getSideBgColor(position.side)} ${getSideColor(position.side)}`}>
                      {position.side}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">{position.quantity}</td>
                  <td className="py-3 px-4 text-right">${position.entryPrice.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">${position.markPrice.toLocaleString()}</td>
                  <td className={`py-3 px-4 text-right font-medium ${getPnLColor(position.pnl)}`}>
                    {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                    <div className="text-xs">
                      ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    ${position.margin.toFixed(2)}
                    <div className="text-xs text-gray-500">{position.leverage}x</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {editingSL === key ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={tempSL}
                          onChange={(e) => setTempSL(parseFloat(e.target.value))}
                          className="w-20 px-1 py-1 text-sm border rounded"
                        />
                        <button
                          onClick={() => saveSL(position)}
                          className="text-green-600 hover:text-green-800"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingSL(null)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSLEdit(position)}
                        className="text-sm hover:bg-gray-100 px-2 py-1 rounded"
                      >
                        {position.stopLoss ? `$${position.stopLoss.toLocaleString()}` : 'Set'}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {editingTP === key ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={tempTP}
                          onChange={(e) => setTempTP(parseFloat(e.target.value))}
                          className="w-20 px-1 py-1 text-sm border rounded"
                        />
                        <button
                          onClick={() => saveTP(position)}
                          className="text-green-600 hover:text-green-800"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingTP(null)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✗
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleTPEdit(position)}
                        className="text-sm hover:bg-gray-100 px-2 py-1 rounded"
                      >
                        {position.takeProfit ? `$${position.takeProfit.toLocaleString()}` : 'Set'}
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onClosePosition && onClosePosition(position.symbol, position.side)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Close
                    </button>
                  </td>
                </tr>
              );
            })}
            {displayPositions.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8 text-gray-500">
                  No open positions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}