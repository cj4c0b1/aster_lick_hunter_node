#!/usr/bin/env python3

import sqlite3
import json
import os
import sys
import asyncio
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
from urllib.parse import urlencode
from math import sqrt, floor, ceil
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: 'requests' library not found. Install with: pip install requests")
    sys.exit(1)

# Configuration constants
API_TIMEOUT_MS = 10000
MAX_RETRIES = 3
DEFAULT_THRESHOLD_WINDOW_MS = 60 * 1000
DEFAULT_THRESHOLD_COOLDOWN_MS = 30 * 1000
HUNTER_COOLDOWN_MS = 2 * 60 * 1000
DAY_MS = 24 * 60 * 60 * 1000
MAX_KLINE_LIMIT = 1500

FORCE_OPTIMIZER_OVERWRITE = os.getenv('FORCE_OPTIMIZER_OVERWRITE') == '1'
FORCE_OPTIMIZER_CONFIRM = os.getenv('FORCE_OPTIMIZER_CONFIRM') == '1'

# Exit slippage model
EXIT_SLIPPAGE = {
    'TP': 0.0010,
    'SL': 0.0050,
    'SL_VOLATILE': 0.0080,
    'ENTRY_LIMIT': 0.0000,
    'ENTRY_MARKET': 0.0020
}

LIMIT_FILL_RATE = 0.85
MARKET_FALLBACK_RATE = 0.10

# Commission model
COMMISSION = {
    'MAKER_FEE': 0.0002,
    'TAKER_FEE': 0.0004,
    'AVG_FILLS_PER_TRADE': 1.5
}

DEFAULT_SCORING_WEIGHTS = {
    'pnl': 50,
    'sharpe': 30,
    'drawdown': 20
}

# Global caches
price_data_cache = {}
symbol_span_cache = {}
scoring_weights = None
normalized_scoring_weights = None


def parse_scoring_weights():
    """Parse and normalize scoring weights from environment."""
    global scoring_weights, normalized_scoring_weights
    
    def parse_weight(value, fallback):
        if value is None or value == '':
            return fallback
        try:
            numeric = float(value)
            if numeric < 0:
                return fallback
            return numeric
        except (ValueError, TypeError):
            return fallback
    
    percent = {
        'pnl': parse_weight(os.getenv('OPTIMIZER_WEIGHT_PNL'), DEFAULT_SCORING_WEIGHTS['pnl']),
        'sharpe': parse_weight(os.getenv('OPTIMIZER_WEIGHT_SHARPE'), DEFAULT_SCORING_WEIGHTS['sharpe']),
        'drawdown': parse_weight(os.getenv('OPTIMIZER_WEIGHT_DRAWDOWN'), DEFAULT_SCORING_WEIGHTS['drawdown'])
    }
    
    total = percent['pnl'] + percent['sharpe'] + percent['drawdown']
    
    if total <= 0:
        fallback_total = sum(DEFAULT_SCORING_WEIGHTS.values())
        scoring_weights = {
            'percent': DEFAULT_SCORING_WEIGHTS,
            'normalized': {k: v / fallback_total for k, v in DEFAULT_SCORING_WEIGHTS.items()},
            'isDefault': True
        }
    else:
        scoring_weights = {
            'percent': percent,
            'normalized': {k: v / total for k, v in percent.items()},
            'isDefault': False
        }
    
    normalized_scoring_weights = scoring_weights['normalized']
    return scoring_weights


def format_number(num):
    """Format number with 2 decimal places."""
    if not isinstance(num, (int, float)) or num != num:  # NaN check
        return "0.00"
    return f"{num:,.2f}"


def format_large_number(num):
    """Format large numbers with K/M suffixes."""
    if not isinstance(num, (int, float)) or num != num:
        return "0.00"
    
    if num >= 1000000:
        return f"{num / 1000000:.2f}M"
    elif num >= 1000:
        return f"{num / 1000:.1f}K"
    return f"{num:.2f}"


def format_currency(num):
    """Format as currency."""
    if isinstance(num, (int, float)) and num == num:
        return f"${format_number(num)}"
    return "n/a"


def format_weight_percent(value):
    """Format weight as percentage."""
    if not isinstance(value, (int, float)) or value != value:
        return "0%"
    
    rounded = round(value, 1)
    if rounded == int(rounded):
        return f"{int(rounded)}%"
    return f"{rounded:.1f}%"


def build_signed_query(params: Dict, credentials: Dict) -> str:
    """Build signed query string for Binance API."""
    timestamp = int(time.time() * 1000)
    query_params = {**params, 'timestamp': timestamp, 'recvWindow': 5000}
    query_string = urlencode(query_params)
    
    signature = hmac.new(
        credentials['secretKey'].encode(),
        query_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return f"{query_string}&signature={signature}"


async def get_account_balance(credentials: Dict) -> Dict:
    """Fetch account balance from API."""
    try:
        query_string = build_signed_query({}, credentials)
        response = requests.get(
            f"https://fapi.asterdex.com/fapi/v2/balance?{query_string}",
            headers={'X-MBX-APIKEY': credentials['apiKey']},
            timeout=API_TIMEOUT_MS / 1000
        )
        response.raise_for_status()
        
        data = response.json()
        usdt_balance = next((a for a in data if a['asset'] == 'USDT'), None)
        
        if usdt_balance:
            return {
                'totalWalletBalance': float(usdt_balance.get('walletBalance', 0)),
                'availableBalance': float(usdt_balance.get('availableBalance', 0)),
                'crossMargin': float(usdt_balance.get('crossUnPnl', 0))
            }
    except Exception as e:
        print(f"⚠️  Failed to fetch balance: {e}")
    
    return {'totalWalletBalance': 0, 'availableBalance': 0, 'crossMargin': 0}


async def get_account_info(credentials: Dict) -> Optional[Dict]:
    """Fetch account info from API."""
    try:
        query_string = build_signed_query({}, credentials)
        response = requests.get(
            f"https://fapi.asterdex.com/fapi/v2/account?{query_string}",
            headers={'X-MBX-APIKEY': credentials['apiKey']},
            timeout=API_TIMEOUT_MS / 1000
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"⚠️  Failed to fetch account info: {e}")
    return None


async def get_current_positions(credentials: Dict) -> List[Dict]:
    """Fetch current positions from API."""
    try:
        query_string = build_signed_query({}, credentials)
        response = requests.get(
            f"https://fapi.asterdex.com/fapi/v2/positionRisk?{query_string}",
            headers={'X-MBX-APIKEY': credentials['apiKey']},
            timeout=API_TIMEOUT_MS / 1000
        )
        response.raise_for_status()
        
        data = response.json()
        return [p for p in data if float(p.get('positionAmt', 0)) != 0]
    except Exception as e:
        print(f"⚠️  Failed to fetch positions: {e}")
    
    return []


async def get_cached_historical_prices(symbol: str, interval: str = '1m', total_candles: int = 10080) -> List[Dict]:
    """Fetch and cache historical price data."""
    cache_key = f"{symbol}:{interval}:{total_candles}"
    
    if cache_key in price_data_cache:
        return price_data_cache[cache_key]
    
    collected = []
    remaining = max(total_candles, 0)
    end_time = None
    
    while remaining > 0:
        request_limit = min(remaining, MAX_KLINE_LIMIT)
        params = {'symbol': symbol, 'interval': interval, 'limit': request_limit}
        
        if end_time:
            params['endTime'] = end_time
        
        try:
            response = requests.get(
                f"https://fapi.asterdex.com/fapi/v1/klines?{urlencode(params)}",
                timeout=API_TIMEOUT_MS / 1000
            )
            response.raise_for_status()
            raw_klines = response.json()
        except Exception as e:
            print(f"⚠️  Failed to fetch price data for {symbol}: {e}")
            break
        
        if not raw_klines:
            break
        
        chunk = [{
            'timestamp': k[0],
            'open': float(k[1]),
            'high': float(k[2]),
            'low': float(k[3]),
            'close': float(k[4]),
            'volume': float(k[5])
        } for k in raw_klines]
        
        collected = chunk + collected
        
        if chunk and isinstance(chunk[0].get('timestamp'), (int, float)):
            end_time = int(chunk[0]['timestamp']) - 1
        else:
            break
        
        if len(raw_klines) < request_limit:
            break
        
        remaining = max(total_candles - len(collected), 0)
    
    price_data = collected[-total_candles:] if len(collected) > total_candles else collected
    price_data_cache[cache_key] = price_data
    return price_data


def compute_percentiles(values: List[float], percentiles: List[float]) -> Dict[float, float]:
    """Compute percentiles from values."""
    if not values:
        return {}
    
    sorted_vals = sorted(values)
    results = {}
    
    for p in percentiles:
        if p <= 0:
            results[p] = sorted_vals[0]
        elif p >= 1:
            results[p] = sorted_vals[-1]
        else:
            index = (len(sorted_vals) - 1) * p
            lower = int(index)
            upper = ceil(index)
            
            if lower == upper:
                results[p] = sorted_vals[lower]
            else:
                weight = index - lower
                results[p] = sorted_vals[lower] * (1 - weight) + sorted_vals[upper] * weight
    
    return results


def dedupe_and_sort(values: List[float]) -> List[float]:
    """Deduplicate and sort values."""
    return sorted(set(v for v in values if isinstance(v, (int, float)) and v == v and v > 0))


def sample_candidates(values: List[float], max_count: int) -> List[float]:
    """Sample candidates from values."""
    sorted_vals = dedupe_and_sort(values)
    
    if len(sorted_vals) <= max_count:
        return sorted_vals
    
    result = []
    step = (len(sorted_vals) - 1) / (max_count - 1)
    
    for i in range(max_count):
        index = round(i * step)
        result.append(sorted_vals[index])
    
    return dedupe_and_sort(result)


def get_liquidation_volumes(db, symbol: str, side: str) -> List[float]:
    """Get liquidation volumes for a symbol and side."""
    cursor = db.cursor()
    cursor.execute(
        "SELECT volume_usdt FROM liquidations WHERE symbol = ? AND side = ?",
        (symbol, side)
    )
    return [float(row[0]) for row in cursor.fetchall() if float(row[0]) > 0]


def generate_threshold_candidates(db, symbol: str, side: str, current_threshold: float) -> List[float]:
    """Generate threshold candidates based on historical volumes."""
    volumes = get_liquidation_volumes(db, symbol, side)
    
    if not volumes:
        return [current_threshold] if current_threshold > 0 else []
    
    percentiles = compute_percentiles(volumes, [0.5, 0.65, 0.75, 0.85, 0.9, 0.95, 0.98])
    candidates = [current_threshold]
    
    for value in percentiles.values():
        if value and value > 0:
            candidates.append(round(value / 10) * 10)
    
    if current_threshold > 0:
        candidates.extend([
            current_threshold * 0.75,
            current_threshold * 0.5,
            current_threshold * 1.25,
            current_threshold * 1.5
        ])
    
    return dedupe_and_sort(candidates)


def compute_price_volatility(price_data: List[Dict]) -> Dict[str, float]:
    """Compute price volatility statistics."""
    if not price_data or len(price_data) < 2:
        return {'avgAbsReturn': 0.5, 'perc90': 1, 'perc95': 1.5}
    
    returns = []
    
    for i in range(1, len(price_data)):
        prev = price_data[i - 1]['close']
        curr = price_data[i]['close']
        
        if prev > 0:
            change_pct = abs(((curr - prev) / prev) * 100)
            if isinstance(change_pct, float) and change_pct == change_pct:
                returns.append(change_pct)
    
    if not returns:
        return {'avgAbsReturn': 0.5, 'perc90': 1, 'perc95': 1.5}
    
    avg_abs_return = sum(returns) / len(returns)
    percentile_values = compute_percentiles(returns, [0.9, 0.95])
    
    return {
        'avgAbsReturn': avg_abs_return,
        'perc90': percentile_values.get(0.9, avg_abs_return),
        'perc95': percentile_values.get(0.95, percentile_values.get(0.9, avg_abs_return))
    }


def generate_tp_candidates(vol_stats: Dict, current_tp: float) -> List[float]:
    """Generate take-profit candidates."""
    base = max(vol_stats.get('avgAbsReturn', 0.3), 0.1)
    high_vol = max(vol_stats.get('perc95', base * 2), base)
    mid_vol = max(vol_stats.get('perc90', base), base)
    
    anchors = []
    if isinstance(current_tp, (int, float)) and current_tp > 0:
        anchors = [current_tp, current_tp * 0.5, current_tp * 0.75, 
                   current_tp * 1.25, current_tp * 1.5, current_tp * 2]
    
    general = [0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]
    dynamic = [
        base * 0.5, base * 0.75, base, base * 1.25, base * 1.5,
        mid_vol, high_vol, high_vol * 1.5, high_vol * 2
    ]
    
    raw_candidates = []
    for val in general + dynamic + anchors:
        if isinstance(val, (int, float)) and 0.05 < val <= 40:
            raw_candidates.append(round(val, 2))
    
    candidates = sample_candidates(raw_candidates, 15)
    return [v for v in candidates if 0.1 <= v <= 30]


def generate_sl_candidates(vol_stats: Dict, current_sl: float) -> List[float]:
    """Generate stop-loss candidates."""
    base = max(vol_stats.get('perc95', vol_stats.get('avgAbsReturn', current_sl) * 2 if current_sl else 1), 0.5)
    
    anchors = []
    if isinstance(current_sl, (int, float)) and current_sl > 0:
        anchors = [current_sl, current_sl * 0.5, current_sl * 0.75,
                   current_sl * 1.25, current_sl * 1.5, current_sl * 2, current_sl * 3]
    
    general = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5]
    dynamic = [
        base * 0.5, base * 0.75, base, base * 1.25, base * 1.5, base * 2, base * 3
    ]
    
    raw_candidates = []
    for val in general + dynamic + anchors:
        if isinstance(val, (int, float)) and 0.1 < val <= 80:
            raw_candidates.append(round(val, 2))
    
    candidates = sample_candidates(raw_candidates, 15)
    return [v for v in candidates if 0.1 <= v <= 40]


def calculate_risk_metrics(trades: List[Dict]) -> Dict[str, float]:
    """Calculate risk metrics from trades."""
    if not trades:
        return {
            'sharpeRatio': 0,
            'maxDrawdown': 0,
            'maxDrawdownPercent': 0,
            'profitFactor': 0
        }
    
    returns = [t['pnl'] for t in trades]
    avg_return = sum(returns) / len(returns)
    
    variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
    std_dev = sqrt(variance)
    
    sharpe_ratio = avg_return / std_dev if std_dev > 0 else 0
    
    peak = 0
    max_drawdown = 0
    running_pnl = 0
    
    for trade in trades:
        running_pnl += trade['pnl']
        if running_pnl > peak:
            peak = running_pnl
        drawdown = peak - running_pnl
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    max_drawdown_percent = (max_drawdown / peak * 100) if peak > 0 else 0
    
    total_wins = sum(t['pnl'] for t in trades if t['pnl'] > 0)
    total_losses = abs(sum(t['pnl'] for t in trades if t['pnl'] < 0))
    profit_factor = total_wins / total_losses if total_losses > 0 else (float('inf') if total_wins > 0 else 0)
    
    return {
        'sharpeRatio': sharpe_ratio,
        'maxDrawdown': max_drawdown,
        'maxDrawdownPercent': max_drawdown_percent,
        'profitFactor': profit_factor
    }


def get_symbol_data_span_days(db, symbol: str) -> float:
    """Get data span in days for a symbol."""
    if symbol in symbol_span_cache:
        return symbol_span_cache[symbol]
    
    cursor = db.cursor()
    cursor.execute(
        "SELECT MIN(event_time) as first_time, MAX(event_time) as last_time FROM liquidations WHERE symbol = ?",
        (symbol,)
    )
    row = cursor.fetchone()
    
    span_days = 0
    if row and row[0] and row[1] and row[1] > row[0]:
        span_days = (row[1] - row[0]) / DAY_MS
    
    span_days = max(span_days, 1 / 24)
    symbol_span_cache[symbol] = span_days
    return span_days


async def backtest_symbol(
    db, symbol: str, side: str, threshold: int, max_positions: int,
    trade_size: float, leverage: float, tp_percent: float, sl_percent: float,
    options: Dict = None
) -> Dict:
    """Run backtest for a symbol."""
    if options is None:
        options = {}
    
    suppress_logs = options.get('suppressLogs', False)
    cooldown_ms = max(0, int(options.get('cooldownMs', 0)))
    hunter_cooldown_ms = max(0, int(options.get('hunterCooldownMs', HUNTER_COOLDOWN_MS)))
    window_ms = max(1000, int(options.get('windowMs', DEFAULT_THRESHOLD_WINDOW_MS)))
    
    def log(*args):
        if not suppress_logs:
            print(*args)
    
    log(f"🔄 Backtesting {symbol} {'LONG' if side == 'SELL' else 'SHORT'} with ${threshold} threshold...")
    
    cursor = db.cursor()
    cursor.execute(
        "SELECT event_time, volume_usdt, price FROM liquidations WHERE symbol = ? AND side = ? ORDER BY event_time",
        (symbol, side)
    )
    liquidations = [{'event_time': row[0], 'volume_usdt': row[1], 'price': row[2]} for row in cursor.fetchall()]
    
    if not liquidations:
        return {
            'totalTrades': 0, 'wins': 0, 'losses': 0, 'totalPnl': 0, 'winRate': 0,
            'avgWin': 0, 'avgLoss': 0, 'avgDuration': 0, 'activePositions': 0,
            'sharpeRatio': 0, 'maxDrawdown': 0, 'maxDrawdownPercent': 0, 'profitFactor': 0
        }
    
    # Get historical prices
    price_data = await get_cached_historical_prices(symbol, '1m', 10080)
    
    all_prices = price_data if price_data else liquidations
    
    active_positions = []
    completed_trades = []
    total_pnl = 0
    price_index = 0
    last_entry_time = float('-inf')
    last_hunter_entry_time = float('-inf')
    
    import random
    
    def record_exit(pos: Dict, exit_price: float, exit_reason: str, price_event_time: float, volatility_factor: float = 1.0):
        nonlocal total_pnl
        
        actual_exit_price = exit_price
        
        if exit_reason == 'TP':
            if pos['isLong']:
                actual_exit_price = exit_price * (1 - EXIT_SLIPPAGE['TP'])
            else:
                actual_exit_price = exit_price * (1 + EXIT_SLIPPAGE['TP'])
        
        elif exit_reason == 'SL':
            slippage_rate = EXIT_SLIPPAGE['SL_VOLATILE'] if volatility_factor > 1.5 else EXIT_SLIPPAGE['SL']
            if pos['isLong']:
                actual_exit_price = exit_price * (1 - slippage_rate)
            else:
                actual_exit_price = exit_price * (1 + slippage_rate)
        
        gross_pnl = (actual_exit_price - pos['entryPrice']) * pos['size'] if pos['isLong'] else (pos['entryPrice'] - actual_exit_price) * pos['size']
        
        notional = trade_size * leverage
        entry_commission = notional * (COMMISSION['MAKER_FEE'] * 0.9 + COMMISSION['TAKER_FEE'] * 0.1)
        exit_commission = notional * COMMISSION['TAKER_FEE'] if exit_reason != 'EOD' else notional * COMMISSION['MAKER_FEE']
        
        total_commission = (entry_commission + exit_commission) * COMMISSION['AVG_FILLS_PER_TRADE']
        net_pnl = gross_pnl - total_commission
        
        total_pnl += net_pnl
        completed_trades.append({
            'symbol': symbol,
            'side': 'LONG' if pos['isLong'] else 'SHORT',
            'entryPrice': pos['entryPrice'],
            'exitPrice': actual_exit_price,
            'triggerPrice': exit_price,
            'slippage': abs(actual_exit_price - exit_price),
            'grossPnl': gross_pnl,
            'commission': total_commission,
            'pnl': net_pnl,
            'exitReason': exit_reason,
            'duration': price_event_time - pos['entryTime'],
            'margin': trade_size,
            'volatilityFactor': volatility_factor if exit_reason == 'SL' else None
        })
    
    def evaluate_positions_on_bar(price_bar: Dict, bar_index: int):
        nonlocal active_positions
        
        filtered_positions = []
        
        for pos in active_positions:
            tp_touched = (price_bar.get('high', price_bar.get('close', 0)) >= pos['tpPrice']) if pos['isLong'] else (price_bar.get('low', price_bar.get('close', 0)) <= pos['tpPrice'])
            sl_touched = (price_bar.get('low', price_bar.get('close', 0)) <= pos['slPrice']) if pos['isLong'] else (price_bar.get('high', price_bar.get('close', 0)) >= pos['slPrice'])
            
            should_exit = False
            exit_reason = None
            exit_price = None
            
            if tp_touched and sl_touched:
                tp_distance = abs(pos['tpPrice'] - pos['entryPrice'])
                sl_distance = abs(pos['slPrice'] - pos['entryPrice'])
                
                if random.random() < 0.70:
                    if sl_distance < tp_distance:
                        exit_reason = 'SL'
                        exit_price = pos['slPrice']
                    else:
                        exit_reason = 'TP'
                        exit_price = pos['tpPrice']
                else:
                    if sl_distance < tp_distance:
                        exit_reason = 'TP'
                        exit_price = pos['tpPrice']
                    else:
                        exit_reason = 'SL'
                        exit_price = pos['slPrice']
                should_exit = True
            
            elif tp_touched:
                should_exit = True
                exit_reason = 'TP'
                exit_price = pos['tpPrice']
            
            elif sl_touched:
                should_exit = True
                exit_reason = 'SL'
                exit_price = pos['slPrice']
            
            if should_exit:
                record_exit(pos, exit_price, exit_reason, price_bar.get('event_time', price_bar.get('timestamp', 0)))
            else:
                filtered_positions.append(pos)
        
        active_positions = filtered_positions
    
    # Process liquidations
    for i, current_event in enumerate(liquidations):
        current_time = current_event['event_time']
        window_start = current_time - window_ms
        
        window_volume = sum(l['volume_usdt'] for l in liquidations[max(0, i-len(liquidations)):i+1] if window_start <= l['event_time'] <= current_time)
        
        # Check price exits
        while price_index < len(all_prices):
            price_bar = all_prices[price_index]
            price_time = price_bar.get('event_time', price_bar.get('timestamp', 0))
            
            if price_time > current_time:
                break
            
            evaluate_positions_on_bar(price_bar, price_index)
            price_index += 1
        
        # Check entry condition
        cooldown_elapsed = current_time - last_entry_time >= cooldown_ms
        hunter_cooldown_elapsed = current_time - last_hunter_entry_time >= hunter_cooldown_ms
        
        if window_volume >= threshold and len(active_positions) < max_positions and cooldown_elapsed and hunter_cooldown_elapsed:
            if random.random() > LIMIT_FILL_RATE:
                continue
            
            entry_price = current_event['price']
            if random.random() < MARKET_FALLBACK_RATE:
                is_long = side == 'SELL'
                entry_price = entry_price * (1 + EXIT_SLIPPAGE['ENTRY_MARKET']) if is_long else entry_price * (1 - EXIT_SLIPPAGE['ENTRY_MARKET'])
            
            is_long = side == 'SELL'
            tp_price = entry_price * (1 + tp_percent / 100) if is_long else entry_price * (1 - tp_percent / 100)
            sl_price = entry_price * (1 - sl_percent / 100) if is_long else entry_price * (1 + sl_percent / 100)
            
            active_positions.append({
                'entryPrice': entry_price,
                'entryTime': current_time,
                'tpPrice': tp_price,
                'slPrice': sl_price,
                'isLong': is_long,
                'size': trade_size * leverage / entry_price
            })
            last_entry_time = current_time
            last_hunter_entry_time = current_time
    
    # Close remaining positions
    while price_index < len(all_prices):
        price_bar = all_prices[price_index]
        evaluate_positions_on_bar(price_bar, price_index)
        price_index += 1
    
    if active_positions:
        fallback_event = liquidations[-1]
        last_bar = all_prices[-1] if all_prices else fallback_event
        fallback_price = last_bar.get('price', last_bar.get('close', 0)) or 0
        
        for pos in active_positions:
            fallback = fallback_price if fallback_price > 0 else pos['entryPrice']
            record_exit(pos, fallback, 'EOD', last_bar.get('event_time', last_bar.get('timestamp', 0)))
        
        active_positions = []
    
    # Calculate statistics
    wins = len([t for t in completed_trades if t['pnl'] > 0])
    losses = len([t for t in completed_trades if t['pnl'] < 0])
    win_rate = (wins / len(completed_trades) * 100) if completed_trades else 0
    avg_win = sum(t['pnl'] for t in completed_trades if t['pnl'] > 0) / wins if wins > 0 else 0
    avg_loss = sum(t['pnl'] for t in completed_trades if t['pnl'] < 0) / losses if losses > 0 else 0
    avg_duration = sum(t['duration'] for t in completed_trades) / len(completed_trades) / 1000 / 60 if completed_trades else 0
    
    risk_metrics = calculate_risk_metrics(completed_trades)
    
    return {
        'totalTrades': len(completed_trades),
        'wins': wins,
        'losses': losses,
        'totalPnl': total_pnl,
        'winRate': win_rate,
        'avgWin': avg_win,
        'avgLoss': avg_loss,
        'avgDuration': avg_duration,
        'activePositions': len(active_positions),
        'recentTrades': completed_trades[-3:] if completed_trades else [],
        **risk_metrics
    }


def analyze_rolling_windows(db, symbol: str, side: str, threshold: float, window_size: int = 60000) -> Dict[str, float]:
    """Analyze 60-second rolling windows."""
    cursor = db.cursor()
    cursor.execute(
        "SELECT event_time, volume_usdt FROM liquidations WHERE symbol = ? AND side = ? ORDER BY event_time",
        (symbol, side)
    )
    liquidations = [{'event_time': row[0], 'volume_usdt': row[1]} for row in cursor.fetchall()]
    
    if not liquidations:
        return {'totalTriggers': 0, 'avgWindowVolume': 0, 'maxWindowVolume': 0, 'dailyTriggers': 0}
    
    triggers = 0
    window_volumes = []
    
    for i, current in enumerate(liquidations):
        current_time = current['event_time']
        window_start = current_time - window_size
        
        window_volume = 0
        for j in range(i, -1, -1):
            if liquidations[j]['event_time'] >= window_start and liquidations[j]['event_time'] <= current_time:
                window_volume += liquidations[j]['volume_usdt']
            elif liquidations[j]['event_time'] < window_start:
                break
        
        window_volumes.append(window_volume)
        
        if window_volume >= threshold:
            triggers += 1
    
    avg_window_volume = sum(window_volumes) / len(window_volumes) if window_volumes else 0
    max_window_volume = max(window_volumes) if window_volumes else 0
    
    span_ms = liquidations[-1]['event_time'] - liquidations[0]['event_time']
    span_days = max(span_ms / DAY_MS, 1 / 24)
    
    return {
        'totalTriggers': triggers,
        'avgWindowVolume': avg_window_volume,
        'maxWindowVolume': max_window_volume,
        'dailyTriggers': triggers / span_days if span_days > 0 else 0,
        'spanDays': span_days
    }


def analyze_price_data_coverage(db):
    """Analyze price data coverage."""
    print('📊 PRICE DATA COVERAGE ANALYSIS')
    print('===============================\n')
    
    cursor = db.cursor()
    cursor.execute(
        "SELECT event_time, price, volume_usdt, side FROM liquidations WHERE symbol = 'ASTERUSDT' ORDER BY event_time LIMIT 10"
    )
    price_data = cursor.fetchall()
    
    print('Sample ASTERUSDT liquidation prices:')
    print('Time (ms)        | Price   | Volume  | Side | Gap (min)')
    print('-----------------|---------|---------|------|----------')
    
    last_time = 0
    for i, row in enumerate(price_data):
        gap = (row[0] - last_time) / 1000 / 60 if i > 0 else 0
        print(f"{row[0]:<16} | ${row[1]:<7.4f} | ${row[2]:<7.0f} | {row[3]:<4} | {gap:.1f}min")
        last_time = row[0]
    
    cursor.execute(
        "SELECT COUNT(*) as total_events, MIN(event_time) as first_time, MAX(event_time) as last_time, AVG(price) as avg_price, MIN(price) as min_price, MAX(price) as max_price FROM liquidations WHERE symbol = 'ASTERUSDT'"
    )
    coverage = cursor.fetchone()
    
    if coverage:
        time_span = (coverage[2] - coverage[1]) / 1000 / 60 / 60
        avg_gap = time_span * 60 / coverage[0] if coverage[0] > 0 else 0
        
        print()
        print(f"📈 ASTERUSDT Price Coverage:")
        print(f"   Total Events: {coverage[0]}")
        print(f"   Time Span: {time_span:.1f} hours")
        print(f"   Average Gap: {avg_gap:.1f} minutes between price points")
        print(f"   Price Range: ${coverage[4]:.4f} - ${coverage[5]:.4f}")
        print()
        
        return avg_gap
    
    return 0


def save_optimized_config(config: Dict, output_path: str = 'config.optimized.json') -> None:
    """Save optimized configuration to a file."""
    try:
        with open(output_path, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"\n✅ Optimized configuration saved to: {output_path}")
    except Exception as e:
        print(f"❌ Failed to save optimized configuration: {e}")

def analyze_current_config(db, config: Dict) -> Dict:
    """
    Analyze current configuration performance and return optimized configuration.
    Returns:
        Dict: Updated configuration with optimized parameters
    """
    print('📊 ROLLING 60-SECOND WINDOW ANALYSIS')
    print('=====================================\n')
    
    optimized_config = config.copy()
    
    for symbol, symbol_config in config.get('symbols', {}).items():
        print(f"📈 {symbol} Analysis:")
        
        time_window_ms = symbol_config.get('thresholdTimeWindow', DEFAULT_THRESHOLD_WINDOW_MS)
        long_threshold = symbol_config.get('longVolumeThresholdUSDT', symbol_config.get('volumeThresholdUSDT', 0))
        short_threshold = symbol_config.get('shortVolumeThresholdUSDT', symbol_config.get('volumeThresholdUSDT', 0))
        trade_size = symbol_config.get('tradeSize', 20)
        leverage = symbol_config.get('leverage', 10)
        tp_percent = symbol_config.get('tpPercent', 1)
        profit_per_trade = trade_size * leverage * (tp_percent / 100)
        
        long_analysis = analyze_rolling_windows(db, symbol, 'SELL', long_threshold)
        short_analysis = analyze_rolling_windows(db, symbol, 'BUY', short_threshold)
        
        # Store optimized values
        if symbol in optimized_config.get('symbols', {}):
            if 'optimized' not in optimized_config['symbols'][symbol]:
                optimized_config['symbols'][symbol]['optimized'] = {}
            
            optimized_config['symbols'][symbol]['optimized'].update({
                'longVolumeThresholdUSDT': long_analysis.get('suggestedThreshold', long_threshold),
                'shortVolumeThresholdUSDT': short_analysis.get('suggestedThreshold', short_threshold),
                'dailyLongTriggers': round(long_analysis.get('dailyTriggers', 0), 1),
                'dailyShortTriggers': round(short_analysis.get('dailyTriggers', 0), 1),
                'estimatedDailyProfit': round((long_analysis.get('dailyTriggers', 0) + short_analysis.get('dailyTriggers', 0)) * profit_per_trade, 2),
                'analysisTime': datetime.now().isoformat()
            })
        
        print(f"   🔼 LONG Opportunities ({time_window_ms/1000:.0f}s rolling SELL liquidations):")
        print(f"      Current Threshold: ${format_large_number(long_threshold)}")
        print(f"      Suggested Threshold: ${format_large_number(long_analysis.get('suggestedThreshold', long_threshold))}")
        print(f"      Daily Triggers: {long_analysis['dailyTriggers']:.1f}")
        print(f"      Daily Profit: ${format_large_number(long_analysis['dailyTriggers'] * profit_per_trade)}")
        print(f"      Avg Window Volume: ${format_large_number(long_analysis['avgWindowVolume'])}")
        print(f"      Max Window Volume: ${format_large_number(long_analysis['maxWindowVolume'])}")
        
        print(f"\n   🔽 SHORT Opportunities ({time_window_ms/1000:.0f}s rolling BUY liquidations):")
        print(f"      Current Threshold: ${format_large_number(short_threshold)}")
        print(f"      Suggested Threshold: ${format_large_number(short_analysis.get('suggestedThreshold', short_threshold))}")
        print(f"      Daily Triggers: {short_analysis['dailyTriggers']:.1f}")
        print(f"      Daily Profit: ${format_large_number(short_analysis['dailyTriggers'] * profit_per_trade)}")
        print(f"      Avg Window Volume: ${format_large_number(short_analysis['avgWindowVolume'])}")
        print(f"      Max Window Volume: ${format_large_number(short_analysis['maxWindowVolume'])}")
        
        total_daily_profit = (long_analysis['dailyTriggers'] + short_analysis['dailyTriggers']) * profit_per_trade
        print(f"\n   💰 Total Daily Profit: ${format_large_number(total_daily_profit)}\n")
        print("-" * 50 + "\n")
    
    return optimized_config


def analyze_capital_allocation(balance: Dict, account_info: Dict, positions: List[Dict], config: Dict):
    """Analyze capital allocation."""
    print('💼 COMPLETE ACCOUNT SNAPSHOT')
    print('=============================\n')
    
    print('💵 DEBUG - Raw Account Data:')
    print(f'Balance API Response: {json.dumps(balance, indent=2)}')
    if account_info:
        print(f'Account API Response keys: {list(account_info.keys())}')
        print(f'Account totalMarginBalance: {account_info.get("totalMarginBalance")}')
        print(f'Account totalWalletBalance: {account_info.get("totalWalletBalance")}')
    print()
    
    print('💵 Account Balance Breakdown:')
    print(f"   Available Balance: ${format_large_number(balance.get('availableBalance', 0))}")
    
    if account_info:
        total_margin_balance = float(account_info.get('totalMarginBalance', 0))
        total_wallet_balance = float(account_info.get('totalWalletBalance', 0))
        total_unrealized_pnl = float(account_info.get('totalUnrealizedProfit', 0))
        used_margin = float(account_info.get('totalInitialMargin', 0))
        
        print(f"   Total Margin Balance: ${format_large_number(total_margin_balance)}")
        print(f"   Total Wallet Balance: ${format_large_number(total_wallet_balance)}")
        print(f"   Used in Positions: ${format_large_number(used_margin)}")
        print(f"   Unrealized PNL: ${format_large_number(total_unrealized_pnl)}")
        print(f"   Maintenance Margin: ${format_large_number(float(account_info.get('totalMaintMargin', 0)))}")
        
        true_total = max(total_margin_balance, total_wallet_balance, balance.get('availableBalance', 0) + used_margin)
        print(f"   🎯 CALCULATED TOTAL: ${format_large_number(true_total)}")
    print()
    
    if positions:
        print(f'📍 CURRENT POSITIONS ({len(positions)} active):')
        print('Symbol      | Side | Size      | Entry Price | Mark Price  | PNL      | Margin   | ROE%')
        print('------------|------|-----------|-------------|-------------|----------|----------|------')
        
        total_pnl = 0
        total_margin = 0
        
        for pos in positions:
            pnl = float(pos.get('unRealizedProfit', 0))
            position_amt = float(pos.get('positionAmt', 0))
            leverage = float(pos.get('leverage', 1)) or 1
            entry_price = float(pos.get('entryPrice', 0))
            mark_price = float(pos.get('markPrice', 0))
            notional = abs(position_amt * entry_price)
            margin_from_exchange = float(pos.get('initialMargin', pos.get('positionInitialMargin', pos.get('isolatedMargin', 0))))
            derived_margin = notional / leverage if leverage > 0 else 0
            margin = margin_from_exchange if margin_from_exchange > 0 else derived_margin
            roe = (pnl / margin * 100) if margin > 0 else 0
            
            total_pnl += pnl
            total_margin += margin
            
            side = 'LONG' if position_amt > 0 else 'SHORT'
            size = abs(position_amt)
            
            print(f"{pos['symbol']:<11} | {side:<4} | {size:<9.4f} | ${entry_price:<10.4f} | ${mark_price:<10.4f} | ${pnl:<8.2f} | ${margin:<8.2f} | {roe:.1f}%")
        
        print('------------|------|-----------|-------------|-------------|----------|----------|------')
        print(f'TOTALS      |      |           |             |             | ${total_pnl:<8.2f} | ${total_margin:<8.2f} |')
        print()
    
    print('⚙️  Global Settings:')
    global_settings = config.get('global', {})
    print(f"   Risk Percent: {global_settings.get('riskPercent')}%")
    print(f"   Max Open Positions: {global_settings.get('maxOpenPositions')}")
    print(f"   Position Mode: {global_settings.get('positionMode')}")
    print()
    
    print('💰 Per-Symbol Capital Allocation:')
    print('Symbol      | Trade Size | Max Margin/Side | Max Positions | Strategy')
    print('------------|------------|-----------------|---------------|----------')
    
    total_max_allocation = 0
    
    for symbol, symbol_config in config.get('symbols', {}).items():
        trade_size = symbol_config.get('tradeSize', 20)
        short_trade_size = symbol_config.get('shortTradeSize', trade_size)
        max_margin_per_side = symbol_config.get('maxPositionMarginUSDT', 100)
        max_long_positions = floor(max_margin_per_side / trade_size)
        max_short_positions = floor(max_margin_per_side / short_trade_size)
        
        total_max_allocation += max_margin_per_side * 2
        
        print(f"{symbol:<11} | ${trade_size:<9.2f} | ${max_margin_per_side:<15.2f} | {max_long_positions}L/{max_short_positions}S | Cascade")
    
    print('------------|------------|-----------------|---------------|----------')
    print(f'TOTAL       |            | ${total_max_allocation:<15.2f} |               |')
    print()
    
    available = balance.get('availableBalance', 0)
    utilization_rate = (total_max_allocation / available * 100) if available > 0 else 0
    safe_indicator = '✅' if utilization_rate <= 80 else '⚠️' if utilization_rate <= 95 else '❌'
    
    print('💰 Capital Utilization:')
    print(f"   Max Allocation (both sides): ${format_large_number(total_max_allocation)} ({utilization_rate:.1f}% of available) {safe_indicator}")
    print(f"   Safe Range: ✅80% optimal, ⚠️95% acceptable")
    print()
    
    return {'totalMaxAllocation': total_max_allocation, 'utilizationRate': utilization_rate}


def analyze_liquidation_cascades(db):
    """Analyze liquidation cascades."""
    print('🌊 LIQUIDATION CASCADE ANALYSIS')
    print('================================\n')
    
    print('Strategy: Multiple Position Accumulation During Cascades')
    print('- Liquidation cascades create price dislocations')
    print('- Accumulate positions as price moves against liquidated traders')
    print('- Average down during cascades, exit on rebound\n')


async def main():
    """Main execution function."""
    try:
        global scoring_weights, normalized_scoring_weights
        
        parse_scoring_weights()
        
        weight_summary = f"{format_weight_percent(scoring_weights['percent']['pnl'])} / {format_weight_percent(scoring_weights['percent']['sharpe'])} / {format_weight_percent(scoring_weights['percent']['drawdown'])}"
        weight_label = ' (default)' if scoring_weights['isDefault'] else ''
        print(f"🎯 Using scoring weights (PnL / Sharpe / Drawdown): {weight_summary}{weight_label}\n")
        
        # Load configuration
        config_path = Path(__file__).parent / 'config.user.json'
        if not config_path.exists():
            print("❌ config.user.json not found")
            return
        
        with open(config_path) as f:
            config = json.load(f)
        
        # Connect to database
        db_path = Path(__file__).parent / 'data' / 'liquidations.db'
        db = sqlite3.connect(str(db_path))
        
        print("📊 Fetching complete account snapshot...\n")
        
        credentials = config.get('api', {})
        balance = await get_account_balance(credentials)
        account_info = await get_account_info(credentials)
        positions = await get_current_positions(credentials)
        
        # Run analyses
        analyze_price_data_coverage(db)
        capital_info = analyze_capital_allocation(balance, account_info, positions, config)
        analyze_liquidation_cascades(db)
        
        # Run optimization and get updated config
        optimized_config = analyze_current_config(db, config)
        
        # Save the optimized configuration
        save_optimized_config(optimized_config, 'config.optimized.json')
        
        print("✅ Analysis complete!")
        print(f"💼 Total account value: ${format_large_number(float(account_info.get('totalMarginBalance', balance.get('totalWalletBalance', 0))))}")
        print('🎯 Strategy: Accumulate positions during cascades, profit on rebounds')
        print('\n📋 Review for detailed recommendations')
        
        db.close()
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    asyncio.run(main())