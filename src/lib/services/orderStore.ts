'use client';

import { EventEmitter } from 'events';
import { Order, OrderFilter, OrderStatus, OrderUpdate } from '../types/order';

interface CachedData<T> {
  data: T;
  timestamp: number;
  loading: boolean;
  error?: string;
}

interface OrderStoreState {
  orders: CachedData<Order[]>;
  activeFilters: OrderFilter;
  maxOrders: number;
}

class OrderStore extends EventEmitter {
  private state: OrderStoreState;
  private fetchPromise: Promise<Order[]> | null = null;
  private readonly CACHE_TTL = 10000; // 10 seconds cache
  private readonly MAX_ORDERS = 500; // Maximum orders to keep in memory

  constructor() {
    super();
    this.state = {
      orders: {
        data: [],
        timestamp: 0,
        loading: false,
      },
      activeFilters: {
        status: OrderStatus.FILLED, // Default to filled orders (closed trades)
        limit: 50,
      },
      maxOrders: this.MAX_ORDERS,
    };
  }

  // Get current orders data
  getOrders(): CachedData<Order[]> {
    return { ...this.state.orders };
  }

  // Get filtered orders based on active filters
  getFilteredOrders(): Order[] {
    const { data } = this.state.orders;
    const { status, symbol, side, type, startTime, endTime } = this.state.activeFilters;

    return data.filter(order => {
      // Filter by status
      if (status) {
        const statusArray = Array.isArray(status) ? status : [status];
        if (!statusArray.includes(order.status)) return false;
      }

      // Filter by symbol
      if (symbol && order.symbol !== symbol) return false;

      // Filter by side
      if (side && order.side !== side) return false;

      // Filter by type
      if (type) {
        const typeArray = Array.isArray(type) ? type : [type];
        if (!typeArray.includes(order.type)) return false;
      }

      // Filter by time range
      if (startTime && order.updateTime < startTime) return false;
      if (endTime && order.updateTime > endTime) return false;

      return true;
    });
  }

  // Set active filters
  setFilters(filters: OrderFilter) {
    this.state.activeFilters = { ...this.state.activeFilters, ...filters };
    this.emit('filters:update', this.state.activeFilters);
    this.emit('orders:filtered', this.getFilteredOrders());
  }

  // Get active filters
  getFilters(): OrderFilter {
    return { ...this.state.activeFilters };
  }

  // Update order from WebSocket
  updateOrder(orderUpdate: OrderUpdate) {
    const { order: wsOrder } = orderUpdate;

    // Convert WebSocket order format to our Order format
    const updatedOrder: Order = {
      symbol: wsOrder.symbol,
      orderId: wsOrder.orderId,
      clientOrderId: wsOrder.clientOrderId,
      price: wsOrder.originalPrice,
      origQty: wsOrder.originalQuantity,
      executedQty: wsOrder.orderFilledAccumulatedQuantity,
      status: wsOrder.orderStatus,
      timeInForce: wsOrder.timeInForce,
      type: wsOrder.orderType,
      side: wsOrder.side,
      stopPrice: wsOrder.stopPrice,
      time: orderUpdate.transactionTime,
      updateTime: orderUpdate.eventTime,
      positionSide: wsOrder.positionSide,
      closePosition: wsOrder.closePosition,
      activatePrice: wsOrder.activationPrice,
      priceRate: wsOrder.callbackRate,
      reduceOnly: wsOrder.isReduceOnly,
      avgPrice: wsOrder.averagePrice,
      origType: wsOrder.originalOrderType,
      realizedProfit: wsOrder.realizedProfit,
      commission: wsOrder.commission,
      commissionAsset: wsOrder.commissionAsset,
      isMaker: wsOrder.isMakerSide,
      lastFilledQty: wsOrder.orderLastFilledQuantity,
      lastFilledPrice: wsOrder.lastFilledPrice,
      tradeId: wsOrder.tradeId,
    };

    // Update or add order in the state
    const existingIndex = this.state.orders.data.findIndex(
      o => o.orderId === updatedOrder.orderId && o.symbol === updatedOrder.symbol
    );

    let orders = [...this.state.orders.data];
    let eventType = 'order:update';

    if (existingIndex >= 0) {
      // Update existing order
      orders[existingIndex] = updatedOrder;
    } else {
      // Add new order at the beginning
      orders.unshift(updatedOrder);
      eventType = 'order:new';

      // Keep only MAX_ORDERS most recent orders
      if (orders.length > this.state.maxOrders) {
        orders = orders.slice(0, this.state.maxOrders);
      }
    }

    // Sort by updateTime descending (most recent first)
    orders.sort((a, b) => b.updateTime - a.updateTime);

    this.state.orders = {
      data: orders,
      timestamp: Date.now(),
      loading: false,
      error: undefined,
    };

    // Emit events
    this.emit('orders:update', orders);
    this.emit(eventType, updatedOrder);

    // Emit specific event for filled orders
    if (updatedOrder.status === OrderStatus.FILLED) {
      this.emit('order:filled', updatedOrder);
    }

    // Re-emit filtered orders if filters are active
    this.emit('orders:filtered', this.getFilteredOrders());
  }

  // Fetch orders from API with deduplication and caching
  async fetchOrders(force: boolean = false): Promise<Order[]> {
    const cached = this.state.orders;

    // Return cached data if still valid
    if (!force && cached.timestamp && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Check if there's already a fetch in progress
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Start new fetch
    this.fetchPromise = this._fetchOrders(force);

    try {
      const result = await this.fetchPromise;
      return result;
    } finally {
      this.fetchPromise = null;
    }
  }

  // Internal fetch method
  private async _fetchOrders(force: boolean = false): Promise<Order[]> {
    this.state.orders.loading = true;
    this.emit('orders:loading');

    try {
      const { status, symbol, startTime, endTime, limit } = this.state.activeFilters;

      // Build query parameters
      const params = new URLSearchParams();
      if (status) {
        if (Array.isArray(status)) {
          params.append('status', status.join(','));
        } else {
          params.append('status', status);
        }
      }
      if (symbol) params.append('symbol', symbol);
      if (startTime) params.append('startTime', startTime.toString());
      if (endTime) params.append('endTime', endTime.toString());
      if (limit) params.append('limit', limit.toString());
      if (force) params.append('force', 'true');

      const url = `/api/orders/all?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Orders API failed: ${response.status}`);
      }

      const data = await response.json();

      // Sort by updateTime descending
      data.sort((a: Order, b: Order) => b.updateTime - a.updateTime);

      this.state.orders = {
        data,
        timestamp: Date.now(),
        loading: false,
        error: undefined,
      };

      this.emit('orders:update', data);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.state.orders = {
        ...this.state.orders,
        loading: false,
        error: errorMessage,
      };
      this.emit('orders:error', errorMessage);
      throw error;
    }
  }

  // Clear all cached data
  clearCache() {
    this.state.orders.timestamp = 0;
    this.fetchPromise = null;
  }

  // Handle WebSocket message
  handleWebSocketMessage(message: any) {
    if (message.type === 'order_update' && message.data) {
      console.log('[OrderStore] Received order update from WebSocket:', message.data);

      // Convert the message to OrderUpdate format
      const orderUpdate: OrderUpdate = {
        eventType: 'ORDER_TRADE_UPDATE',
        eventTime: message.data.E || Date.now(),
        transactionTime: message.data.T || Date.now(),
        order: {
          symbol: message.data.o?.s,
          clientOrderId: message.data.o?.c,
          side: message.data.o?.S,
          orderType: message.data.o?.o,
          timeInForce: message.data.o?.f,
          originalQuantity: message.data.o?.q,
          originalPrice: message.data.o?.p,
          averagePrice: message.data.o?.ap,
          stopPrice: message.data.o?.sp,
          executionType: message.data.o?.x,
          orderStatus: message.data.o?.X,
          orderId: message.data.o?.i,
          orderLastFilledQuantity: message.data.o?.l,
          orderFilledAccumulatedQuantity: message.data.o?.z,
          lastFilledPrice: message.data.o?.L,
          commissionAsset: message.data.o?.N,
          commission: message.data.o?.n,
          orderTradeTime: message.data.o?.T,
          tradeId: message.data.o?.t,
          bidsNotional: message.data.o?.b,
          askNotional: message.data.o?.a,
          isMakerSide: message.data.o?.m,
          isReduceOnly: message.data.o?.R,
          workingType: message.data.o?.wt,
          originalOrderType: message.data.o?.ot,
          positionSide: message.data.o?.ps,
          closePosition: message.data.o?.cp,
          activationPrice: message.data.o?.AP,
          callbackRate: message.data.o?.cr,
          realizedProfit: message.data.o?.rp,
        },
      };

      this.updateOrder(orderUpdate);
    }
  }

  // Get order statistics
  getStatistics() {
    const orders = this.state.orders.data;
    const filled = orders.filter(o => o.status === OrderStatus.FILLED);
    const profit = filled.reduce((sum, o) => {
      const pnl = parseFloat(o.realizedProfit || '0');
      return sum + (pnl > 0 ? pnl : 0);
    }, 0);
    const loss = filled.reduce((sum, o) => {
      const pnl = parseFloat(o.realizedProfit || '0');
      return sum + (pnl < 0 ? Math.abs(pnl) : 0);
    }, 0);

    return {
      total: orders.length,
      filled: filled.length,
      open: orders.filter(o =>
        o.status === OrderStatus.NEW ||
        o.status === OrderStatus.PARTIALLY_FILLED
      ).length,
      canceled: orders.filter(o => o.status === OrderStatus.CANCELED).length,
      totalProfit: profit,
      totalLoss: loss,
      netPnL: profit - loss,
      winRate: filled.length > 0
        ? (filled.filter(o => parseFloat(o.realizedProfit || '0') > 0).length / filled.length) * 100
        : 0,
    };
  }
}

// Global singleton instance
const orderStore = new OrderStore();

// Export singleton instance
export default orderStore;