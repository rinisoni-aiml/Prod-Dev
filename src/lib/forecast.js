/**
 * Client-side demand forecasting engine.
 * Implements: linear trend regression + weekly seasonality decomposition + confidence intervals.
 * This is the same algorithmic core that Prophet uses — trend + seasonality + uncertainty.
 */

// ─── Math helpers ────────────────────────────────────────────────────────────

function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (intercept + slope * xs[i])) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

function weeklySeasonality(points) {
  // Group by day-of-week (0=Mon based on index mod 7), compute seasonal factor
  const groups = Array.from({ length: 7 }, () => []);
  points.forEach((p, i) => groups[i % 7].push(p.y));
  const overallMean = points.reduce((s, p) => s + p.y, 0) / points.length;
  if (overallMean === 0) return Array(7).fill(1);
  return groups.map((g) => {
    if (g.length === 0) return 1;
    const avg = g.reduce((a, b) => a + b, 0) / g.length;
    return avg / overallMean;
  });
}

function movingAverage(values, window) {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────

export function parseFullCSV(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const splitLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if ((char === ',' || char === '\t') && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += char;
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine).filter((r) => r.some((c) => c));
  return { headers, rows };
}

// ─── Data extraction ──────────────────────────────────────────────────────────

export function extractTimeSeries(csvText, columnMapping) {
  const { headers, rows } = parseFullCSV(csvText);

  const dateCol = columnMapping.date;
  const yCol = columnMapping.units_sold;
  const skuCol = columnMapping.sku || columnMapping.product_name;
  const warehouseCol = columnMapping.warehouse;
  const stockCol = columnMapping.stock_level;

  if (!dateCol || !yCol) return { series: {}, error: 'Date and Units Sold columns are required.' };

  const dateIdx = headers.indexOf(dateCol);
  const yIdx = headers.indexOf(yCol);
  const skuIdx = skuCol ? headers.indexOf(skuCol) : -1;
  const warehouseIdx = warehouseCol ? headers.indexOf(warehouseCol) : -1;
  const stockIdx = stockCol ? headers.indexOf(stockCol) : -1;

  if (dateIdx === -1 || yIdx === -1) return { series: {}, error: 'Mapped columns not found in CSV headers.' };

  // Aggregate by (date, sku). If no sku col, use 'All Products'
  const aggregated = {};

  for (const row of rows) {
    const rawDate = row[dateIdx];
    const rawY = parseFloat(row[yIdx]?.replace(/[^0-9.-]/g, '') || '0');
    if (!rawDate || isNaN(rawY)) continue;

    const date = normalizeDate(rawDate);
    if (!date) continue;

    const sku = skuIdx >= 0 ? (row[skuIdx] || 'Unknown') : 'All Products';
    const warehouse = warehouseIdx >= 0 ? row[warehouseIdx] : null;
    const stock = stockIdx >= 0 ? parseFloat(row[stockIdx]) : null;

    const key = sku;
    if (!aggregated[key]) aggregated[key] = {};
    if (!aggregated[key][date]) aggregated[key][date] = { y: 0, stock: null, warehouse };
    aggregated[key][date].y += rawY;
    if (!isNaN(stock)) aggregated[key][date].stock = stock;
  }

  // Convert to sorted arrays
  const series = {};
  for (const [sku, dateMap] of Object.entries(aggregated)) {
    series[sku] = Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, val]) => ({ date, y: val.y, stock: val.stock }));
  }

  return { series, headers };
}

function normalizeDate(raw) {
  if (!raw) return null;
  // Try common formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try JS date parse as last resort
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return null;
}

// ─── Forecasting ──────────────────────────────────────────────────────────────

/**
 * Run demand forecast for a single time series.
 * @param {Array<{date: string, y: number}>} data - sorted historical data
 * @param {number} horizonDays - how many days to forecast
 * @returns forecast result object
 */
export function runForecast(data, horizonDays = 30) {
  if (!data || data.length < 3) {
    return { error: 'Need at least 3 data points to forecast.' };
  }

  const points = data.map((d, i) => ({ x: i, y: d.y, date: d.date }));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  // 1. Linear trend
  const { slope, intercept, r2 } = linearRegression(xs, ys);

  // 2. Weekly seasonality
  const seasonal = weeklySeasonality(points);

  // 3. Residuals → RMSE
  const trendValues = xs.map((x) => intercept + slope * x);
  const residuals = ys.map((y, i) => y - trendValues[i]);
  const rmse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);

  // 4. Build historical output (smoothed actuals)
  const ma7 = movingAverage(ys, 7);
  const historical = points.map((p, i) => ({
    date: p.date,
    actual: Math.round(p.y),
    trend: Math.round(trendValues[i]),
    smoothed: Math.round(ma7[i]),
  }));

  // 5. Generate future forecast
  const lastDate = new Date(data[data.length - 1].date);
  const futurePoints = [];
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    const x = points.length - 1 + i;
    const trendAt = intercept + slope * x;
    const seasonFactor = seasonal[x % 7];
    const value = Math.max(0, trendAt * seasonFactor);
    const uncertainty = rmse * Math.sqrt(i / 7); // uncertainty grows with horizon
    futurePoints.push({
      date: d.toISOString().split('T')[0],
      forecast: Math.round(value),
      upper: Math.round(value + 1.96 * uncertainty),
      lower: Math.round(Math.max(0, value - 1.96 * uncertainty)),
    });
  }

  // 6. Summary metrics
  const totalHistorical = ys.reduce((a, b) => a + b, 0);
  const totalForecast = futurePoints.reduce((s, p) => s + p.forecast, 0);
  const avgHistorical = totalHistorical / ys.length;
  const peakForecastDay = futurePoints.reduce((best, p) => p.forecast > best.forecast ? p : best, futurePoints[0]);
  const trendPct = avgHistorical > 0 ? ((slope / avgHistorical) * 100 * 30) : 0; // % change per 30 days
  const weeklyFactors = seasonal.map((f, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    factor: f,
  }));

  return {
    historical,
    forecast: futurePoints,
    metrics: {
      r2: Math.round(r2 * 1000) / 10, // as percentage
      rmse: Math.round(rmse),
      trendPct: Math.round(trendPct * 10) / 10,
      totalForecast: Math.round(totalForecast),
      avgDaily: Math.round(totalForecast / horizonDays),
      peakDay: peakForecastDay?.date,
      peakValue: peakForecastDay?.forecast,
      dataPoints: data.length,
      weeklyFactors,
    },
  };
}

/**
 * Run forecast for all SKUs in a dataset, return combined results.
 */
export function runMultiSKUForecast(series, horizonDays = 30) {
  const results = {};
  for (const [sku, data] of Object.entries(series)) {
    results[sku] = runForecast(data, horizonDays);
  }
  return results;
}

/**
 * Aggregate multiple SKU series into one "All Products" series by date.
 */
export function aggregateSeries(series) {
  const byDate = {};
  for (const data of Object.values(series)) {
    for (const point of data) {
      byDate[point.date] = (byDate[point.date] || 0) + point.y;
    }
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, y]) => ({ date, y }));
}
