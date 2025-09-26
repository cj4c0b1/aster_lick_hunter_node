'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  RefreshCw,
  ChevronDown,
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
  const [chartType, setChartType] = useState<ChartType>('cumulative');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('usdt');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pnlData, setPnlData] = useState<PnLData | null>(null);
  const [realtimePnL, setRealtimePnL] = useState<any>(null);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Data validation helper
  const validateDailyPnLData = (data: any[]): DailyPnL[] => {
    return data.filter(item => {
      return (
        item &&
        typeof item.date === 'string' &&
        typeof item.netPnl === 'number' &&
        typeof item.realizedPnl === 'number' &&
        typeof item.commission === 'number' &&
        typeof item.fundingFee === 'number' &&
        typeof item.tradeCount === 'number' &&
        !isNaN(item.netPnl) &&
        !isNaN(item.realizedPnl) &&
        !isNaN(item.commission) &&
        !isNaN(item.fundingFee) &&
        !isNaN(item.tradeCount)
      );
    });
  };

  // Fetch PnL data function
  const fetchPnLData = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await fetch(`/api/income?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        // Validate and clean data structure
        if (data && data.metrics && Array.isArray(data.dailyPnL)) {
          const validatedDailyPnL = validateDailyPnLData(data.dailyPnL);
          setPnlData({
            ...data,
            dailyPnL: validatedDailyPnL
          });
          console.log(`[PnL Chart] Loaded ${validatedDailyPnL.length} valid daily PnL records for ${timeRange}`);
          console.log(`[PnL Chart] Daily PnL data for ${timeRange}:`, validatedDailyPnL);
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
      setIsRefreshing(false);
    }
  };

  // Fetch historical PnL data on mount and when timeRange changes
  useEffect(() => {
    fetchPnLData();
  }, [timeRange]);

  // Fetch initial real-time session data and balance
  useEffect(() => {
    const fetchRealtimeData = async () => {
      try {
        // Fetch realtime PnL
        const response = await fetch('/api/pnl/realtime');
        if (response.ok) {
          const data = await response.json();
          setRealtimePnL(data);
        }

        // Fetch balance
        const balanceResponse = await fetch('/api/balance');
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setTotalBalance(balanceData.totalBalance || 0);
        }
      } catch (error) {
        console.error('Failed to fetch realtime PnL or balance:', error);
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

  // Enhanced data processing with better real-time integration
  const chartData = useMemo(() => {
    if (!pnlData?.dailyPnL) return [];

    console.log(`[PnL Chart] Processing data for ${timeRange}:`);
    console.log(`[PnL Chart] - Historical data: ${pnlData.dailyPnL.length} days`);
    console.log(`[PnL Chart] - Session data available: ${!!realtimePnL?.session}`);

    const today = new Date().toISOString().split('T')[0];
    let processedData = [...pnlData.dailyPnL];

    // Log initial data state
    const todayInHistorical = processedData.find(d => d.date === today);
    if (todayInHistorical) {
      console.log(`[PnL Chart] Today's historical data:`, todayInHistorical);
    } else {
      console.log(`[PnL Chart] No historical data for today (${today})`);
    }

    // DISABLED: Session data integration removed since we want to show actual historical trading data
    // The APIs now provide complete and consistent historical data including today's trades
    console.log(`[PnL Chart] Using pure historical data without session integration`);

    // Ensure data is sorted chronologically
    processedData.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`[PnL Chart] Before filtering: ${processedData.length} days`);
    if (processedData.length > 0) {
      console.log(`[PnL Chart] Date range: ${processedData[0].date} to ${processedData[processedData.length - 1].date}`);
    }

    // CRITICAL FIX: Remove client-side filtering for shorter ranges
    // The API already filters correctly, and client-side filtering can cause data inconsistencies
    if (timeRange === '1y' || timeRange === 'all') {
      // Only filter for very long ranges where we might want to limit chart performance
      const cutoffDate = new Date();
      if (timeRange === '1y') {
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
      } else {
        // For 'all', limit to 2 years for performance
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
      }
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      console.log(`[PnL Chart] Filtering ${timeRange}: cutoff date = ${cutoffDateString}`);

      const beforeFilter = processedData.length;
      processedData = processedData.filter(d => d.date >= cutoffDateString);

      console.log(`[PnL Chart] After filtering: ${processedData.length} days (removed ${beforeFilter - processedData.length})`);
    } else {
      console.log(`[PnL Chart] No client-side filtering for ${timeRange} - using API-filtered data directly`);
    }

    // Calculate cumulative PnL if needed
    if (chartType === 'cumulative') {
      let cumulative = 0;
      return processedData.map(day => {
        cumulative += day.netPnl;
        return {
          ...day,
          cumulativePnl: cumulative,
        };
      });
    }

    console.log(`[PnL Chart] Final chart data for ${timeRange}: ${processedData.length} days`);
    if (processedData.length > 0) {
      const lastDay = processedData[processedData.length - 1];
      console.log(`[PnL Chart] Last day in ${timeRange}:`, lastDay);
    }

    return processedData;
  }, [pnlData, realtimePnL, chartType, timeRange]);

  // Format value based on display mode
  const formatValue = (value: number) => {
    if (displayMode === 'percent') {
      return `${value.toFixed(2)}%`;
    }
    return `$${value.toFixed(2)}`;
  };

  // Smart date formatting based on time range
  const formatDateTick = (value: string) => {
    // CRITICAL FIX: Parse date string correctly to avoid timezone shift
    // "2025-09-26" should display as 9/26, not 9/25
    const [year, month, day] = value.split('-').map(Number);

    switch (timeRange) {
      case '24h':
        return `${month}/${day}`;  // Show month/day for daily data
      case '7d':
        return `${month}/${day}`;
      case '30d':
      case '90d':
        return `${month}/${day}`;
      case '1y':
      case 'all':
        return `${year}-${month.toString().padStart(2, '0')}`;
      default:
        return `${month}/${day}`;
    }
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
      const isDaily = chartType === 'daily';
      const displayValue = isDaily ? data.netPnl : data.cumulativePnl;

      return (
        <div className="bg-background border rounded shadow-lg p-2">
          <p className="text-xs font-semibold">{new Date(label).toLocaleDateString()}</p>
          <div className="space-y-0.5 mt-1">
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                {isDaily ? 'Net PnL' : 'Cumulative'}
              </span>
              <span className={`font-medium ${displayValue >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatTooltipValue(displayValue)}
              </span>
            </div>
            {isDaily && (
              <>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Realized</span>
                  <span className={data.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatTooltipValue(data.realizedPnl)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Fees</span>
                  <span className="text-red-500">{formatTooltipValue(data.commission)}</span>
                </div>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Funding</span>
                  <span className={data.fundingFee >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatTooltipValue(data.fundingFee)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">Trades</span>
                  <span>{data.tradeCount}</span>
                </div>
              </>
            )}
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

  // Handle empty data state
  if (!pnlData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Chart
              </CardTitle>
              <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
            </button>
            {!isCollapsed && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchPnLData(true)}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
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
            )}
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              <div className="text-center space-y-1">
                <BarChart3 className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm font-medium">No trading data available</p>
                <p className="text-xs">
                  {pnlData?.error
                    ? `Error: ${pnlData.error}`
                    : `No PnL data found for the selected ${timeRange} period`}
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  const metrics = pnlData?.metrics;

  // Calculate PnL percentage and APR
  const pnlPercentage = totalBalance > 0 ? (metrics?.totalPnl ?? 0) / totalBalance * 100 : 0;

  // Calculate APR based on the time range and actual days with data
  const calculateAPR = () => {
    if (!metrics || !chartData.length || totalBalance <= 0) return 0;

    const daysWithData = chartData.length;
    const totalReturn = metrics.totalPnl / totalBalance;

    // Annualize the return based on actual trading days
    const annualizedReturn = (totalReturn / daysWithData) * 365;
    return annualizedReturn * 100; // Convert to percentage
  };

  const apr = calculateAPR();

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
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Chart
            </CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          </button>
          {!isCollapsed && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => fetchPnLData(true)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
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
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
        {/* Performance Summary */}
        {safeMetrics && (
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Total PnL</p>
              <p className={`text-sm font-semibold ${safeMetrics.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatTooltipValue(safeMetrics.totalPnl)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">PnL %</p>
              <p className={`text-sm font-semibold ${pnlPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-sm font-semibold">{safeMetrics.winRate.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">APR %</p>
              <p className={`text-sm font-semibold ${apr >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {apr >= 0 ? '+' : ''}{apr.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Chart with refresh overlay */}
        <div className="relative">
          {isRefreshing && (
            <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <ResponsiveContainer width="100%" height={250}>
            {chartType === 'daily' ? (
            <BarChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={formatDateTick}
                domain={['dataMin', 'dataMax']}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" />
              <Bar
                dataKey="netPnl"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.netPnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={formatDateTick}
              />
              <YAxis tick={{ fontSize: 10 }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#666" />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke={chartData.length > 0 && chartData[chartData.length - 1].cumulativePnl >= 0 ? "#10b981" : "#ef4444"}
                fill={chartData.length > 0 && chartData[chartData.length - 1].cumulativePnl >= 0 ? "#10b98140" : "#ef444440"}
                strokeWidth={2}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
        </div>

        {/* Additional Metrics */}
        {safeMetrics && (
          <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Best Day</p>
              <p className="text-xs font-medium text-green-500">
                {safeMetrics.bestDay ? formatTooltipValue(safeMetrics.bestDay.netPnl) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Worst Day</p>
              <p className="text-xs font-medium text-red-500">
                {safeMetrics.worstDay ? formatTooltipValue(safeMetrics.worstDay.netPnl) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Daily</p>
              <p className="text-xs font-medium">
                {formatTooltipValue(safeMetrics.avgDailyPnl)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Drawdown</p>
              <p className="text-xs font-medium text-orange-500">
                {formatTooltipValue(safeMetrics.maxDrawdown)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}