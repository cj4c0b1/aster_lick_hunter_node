'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Calendar,
  BarChart3,
  LineChartIcon,
} from 'lucide-react';
import websocketService from '@/lib/services/websocketService';

type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
type ChartType = 'daily' | 'cumulative';
type DisplayMode = 'usdt' | 'percent';

interface DailyPnL {
  date: string;
  realizedPnl: number;
  commission: number;
  fundingFee: number;
  netPnl: number;
  tradeCount: number;
}

interface PerformanceMetrics {
  totalPnl: number;
  winRate: number;
  profitableDays: number;
  lossDays: number;
  bestDay: DailyPnL | null;
  worstDay: DailyPnL | null;
  avgDailyPnl: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
}

interface PnLData {
  dailyPnL: DailyPnL[];
  metrics: PerformanceMetrics;
  range: string;
  error?: string;
}

export default function PnLChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [chartType, setChartType] = useState<ChartType>('daily');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('usdt');
  const [isLoading, setIsLoading] = useState(true);
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [realtimePnL, setRealtimePnL] = useState<any>(null);

  // Fetch historical PnL data
  useEffect(() => {
    const fetchPnLData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/income?range=${timeRange}`);
        if (response.ok) {
          const data = await response.json();
          // Validate data structure
          if (data && data.metrics) {
            setPnlData(data);
          } else {
            console.error('Invalid PnL data structure:', data);
            setPnlData(null);
          }
        } else {
          console.error('Failed to fetch PnL data, status:', response.status);
          setPnlData(null);
        }
      } catch (error) {
        console.error('Failed to fetch PnL data:', error);
        setPnlData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPnLData();
  }, [timeRange]);

  // Fetch initial real-time session data
  useEffect(() => {
    const fetchRealtimeData = async () => {
      try {
        const response = await fetch('/api/pnl/realtime');
        if (response.ok) {
          const data = await response.json();
          setRealtimePnL(data);
        }
      } catch (error) {
        console.error('Failed to fetch realtime PnL:', error);
      }
    };

    fetchRealtimeData();
  }, []);

  // Subscribe to real-time PnL updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'pnl_update') {
        setRealtimePnL(message.data);
      }
    };

    const cleanup = websocketService.addMessageHandler(handleMessage);
    return cleanup;
  }, []);

  // Process chart data
  const chartData = useMemo(() => {
    if (!pnlData?.dailyPnL) return [];

    const data = [...pnlData.dailyPnL];
    const today = new Date().toISOString().split('T')[0];

    // Check if today's data exists in historical data
    const todayIndex = data.findIndex(d => d.date === today);
    const hasToday = todayIndex >= 0;

    // Log the data differences
    console.log(`[PnL Chart] Time Range: ${timeRange}`);
    console.log(`[PnL Chart] Historical data points: ${data.length}`);
    console.log(`[PnL Chart] Today (${today}) in historical data: ${hasToday}`);
    if (hasToday) {
      console.log(`[PnL Chart] Today's historical data:`, data[todayIndex]);
    }
    console.log(`[PnL Chart] Session data available: ${!!realtimePnL?.session}`);
    if (realtimePnL?.session) {
      console.log(`[PnL Chart] Session data:`, {
        realizedPnl: realtimePnL.session.realizedPnl,
        commission: realtimePnL.session.commission,
        fundingFee: realtimePnL.session.fundingFee,
        tradeCount: realtimePnL.session.tradeCount,
        startingAccumulatedPnl: realtimePnL.session.startingAccumulatedPnl,
        currentAccumulatedPnl: realtimePnL.session.currentAccumulatedPnl,
      });
    }

    // Merge today's data from real-time session with historical data
    if (realtimePnL?.session) {
      if (hasToday) {
        // Merge session data with existing today's data from API
        const existingToday = data[todayIndex];
        const sessionData: DailyPnL = {
          date: today,
          // Add session PnL to any existing historical PnL for today
          realizedPnl: existingToday.realizedPnl + realtimePnL.session.realizedPnl,
          commission: existingToday.commission + realtimePnL.session.commission,
          fundingFee: existingToday.fundingFee + realtimePnL.session.fundingFee,
          netPnl: 0, // Calculate below
          tradeCount: existingToday.tradeCount + realtimePnL.session.tradeCount,
        };
        // Recalculate net PnL
        sessionData.netPnl = sessionData.realizedPnl + sessionData.commission + sessionData.fundingFee;
        data[todayIndex] = sessionData;
      } else {
        // Add today's data from session if it doesn't exist in historical
        const todayData: DailyPnL = {
          date: today,
          realizedPnl: realtimePnL.session.realizedPnl,
          commission: realtimePnL.session.commission,
          fundingFee: realtimePnL.session.fundingFee,
          netPnl: realtimePnL.session.realizedPnl + realtimePnL.session.commission + realtimePnL.session.fundingFee,
          tradeCount: realtimePnL.session.tradeCount,
        };
        data.push(todayData);
      }
    } else if (!hasToday) {
      // If no real-time session and no today's data, add a zero entry for today
      // This ensures today always appears on the chart
      data.push({
        date: today,
        realizedPnl: 0,
        commission: 0,
        fundingFee: 0,
        netPnl: 0,
        tradeCount: 0,
      });
    }

    // Sort by date to ensure correct order
    data.sort((a, b) => a.date.localeCompare(b.date));

    // Log the final data for debugging
    console.log(`[PnL Chart] Final data points: ${data.length}`);
    const todayFinal = data.find(d => d.date === today);
    if (todayFinal) {
      console.log(`[PnL Chart] Today's final merged data:`, todayFinal);
    }

    // Log last few days for comparison
    if (data.length > 0) {
      const lastDays = data.slice(-3);
      console.log(`[PnL Chart] Last 3 days of data:`, lastDays);
    }

    // Calculate cumulative PnL if needed
    if (chartType === 'cumulative') {
      let cumulative = 0;
      return data.map(day => {
        cumulative += day.netPnl;
        return {
          ...day,
          cumulativePnl: cumulative,
        };
      });
    }

    return data;
  }, [pnlData, realtimePnL, chartType]);

  // Format value based on display mode
  const formatValue = (value: number) => {
    if (displayMode === 'percent') {
      return `${value.toFixed(2)}%`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold">{label}</p>
          <div className="space-y-1 mt-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Net PnL:</span>
              <span className={data.netPnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatTooltipValue(data.netPnl)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Realized:</span>
              <span>{formatTooltipValue(data.realizedPnl)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Commission:</span>
              <span className="text-red-500">{formatTooltipValue(data.commission)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Funding:</span>
              <span>{formatTooltipValue(data.fundingFee)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Trades:</span>
              <span>{data.tradeCount}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const metrics = pnlData?.metrics;

  // Defensive check for metrics
  const safeMetrics = metrics ? {
    totalPnl: metrics.totalPnl ?? 0,
    winRate: metrics.winRate ?? 0,
    profitFactor: metrics.profitFactor ?? 0,
    sharpeRatio: metrics.sharpeRatio ?? 0,
    bestDay: metrics.bestDay,
    worstDay: metrics.worstDay,
    avgDailyPnl: metrics.avgDailyPnl ?? 0,
    maxDrawdown: metrics.maxDrawdown ?? 0,
  } : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Chart
          </CardTitle>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
                <SelectItem value="1y">1 Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Performance Summary */}
        {safeMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total PnL</p>
              <p className={`text-xl font-bold ${safeMetrics.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatTooltipValue(safeMetrics.totalPnl)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-xl font-bold">{safeMetrics.winRate.toFixed(1)}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Profit Factor</p>
              <p className="text-xl font-bold">
                {safeMetrics.profitFactor === Infinity ? '∞' : safeMetrics.profitFactor.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
              <p className="text-xl font-bold">
                {safeMetrics.sharpeRatio.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'daily' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" />
              <Bar
                dataKey="netPnl"
                fill={(entry: any) => (entry.netPnl >= 0 ? '#10b981' : '#ef4444')}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke="#3b82f6"
                fill="#3b82f680"
                strokeWidth={2}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>

        {/* Additional Metrics */}
        {safeMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Best Day</p>
              <p className="text-sm font-medium text-green-500">
                {safeMetrics.bestDay ? formatTooltipValue(safeMetrics.bestDay.netPnl) : '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Worst Day</p>
              <p className="text-sm font-medium text-red-500">
                {safeMetrics.worstDay ? formatTooltipValue(safeMetrics.worstDay.netPnl) : '-'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg Daily</p>
              <p className="text-sm font-medium">
                {formatTooltipValue(safeMetrics.avgDailyPnl)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Max Drawdown</p>
              <p className="text-sm font-medium text-orange-500">
                {formatTooltipValue(safeMetrics.maxDrawdown)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}