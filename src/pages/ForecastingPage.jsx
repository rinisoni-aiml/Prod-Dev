import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Line, Area, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell, ReferenceLine,
} from 'recharts';
import { Sparkles, ArrowRight, Upload, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { fetchDataFiles, getFileDownloadUrl } from '@/lib/dataFiles';
import { extractTimeSeries, runForecast, aggregateSeries, runMultiSKUForecast } from '@/lib/forecast';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const HORIZONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const ForecastingPage = () => {
  const { user } = useAuthStore();
  const { openChat } = useChatStore();
  const navigate = useNavigate();

  const [dataFiles, setDataFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [running, setRunning] = useState(false);

  const [horizon, setHorizon] = useState(30);
  const [selectedSKU, setSelectedSKU] = useState('All Products');

  const [skuList, setSkuList] = useState(['All Products']);
  const [allResults, setAllResults] = useState(null); // { [sku]: forecastResult }
  const [chartData, setChartData] = useState([]); // combined historical + forecast for chart
  const [metrics, setMetrics] = useState(null);

  // Load user's data files on mount
  useEffect(() => {
    if (!user) return;
    fetchDataFiles(user.id)
      .then((files) => {
        setDataFiles(files);
        if (files.length > 0) setSelectedFileId(files[0].id);
      })
      .catch(() => toast.error('Failed to load data files'))
      .finally(() => setLoadingFiles(false));
  }, [user]);

  const runForecastForFile = useCallback(async (fileId, horizonDays) => {
    const fileRecord = dataFiles.find((f) => f.id === fileId);
    if (!fileRecord) return;

    if (!fileRecord.column_mapping?.date || !fileRecord.column_mapping?.units_sold) {
      toast.error('This file needs "Date" and "Units Sold" columns mapped before forecasting. Go to Data Upload to remap.');
      return;
    }

    setRunning(true);
    setAllResults(null);
    setChartData([]);
    setMetrics(null);

    try {
      // 1. Download actual file from Supabase Storage
      const url = await getFileDownloadUrl(fileRecord.storage_path);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to download file');
      const csvText = await resp.text();

      // 2. Extract time series from actual CSV data using the saved column mapping
      const { series, error } = extractTimeSeries(csvText, fileRecord.column_mapping);
      if (error) throw new Error(error);
      if (Object.keys(series).length === 0) throw new Error('No usable data rows found in file.');

      // 3. Run multi-SKU forecast
      const results = runMultiSKUForecast(series, horizonDays);

      // 4. Build "All Products" aggregate
      const aggSeries = aggregateSeries(series);
      const aggResult = runForecast(aggSeries, horizonDays);
      results['All Products'] = aggResult;

      const skus = ['All Products', ...Object.keys(series)];
      setSkuList(skus);
      setAllResults(results);
      setSelectedSKU('All Products');
      applyResult(aggResult);

      toast.success(`Forecast complete — ${Object.keys(series).length} product(s) analysed`);
    } catch (err) {
      toast.error(err.message || 'Forecast failed');
    } finally {
      setRunning(false);
    }
  }, [dataFiles]);

  function applyResult(result) {
    if (!result || result.error) { setChartData([]); setMetrics(null); return; }
    // Combine historical + forecast into one array for the chart
    const combined = [
      ...result.historical.map((p) => ({ date: p.date, actual: p.actual, smoothed: p.smoothed })),
      ...result.forecast.map((p) => ({ date: p.date, forecast: p.forecast, upper: p.upper, lower: p.lower })),
    ];
    setChartData(combined);
    setMetrics(result.metrics);
  }

  // When user changes SKU selection
  useEffect(() => {
    if (!allResults || !selectedSKU) return;
    const result = allResults[selectedSKU];
    applyResult(result);
  }, [selectedSKU, allResults]);

  // Re-run when horizon changes and we already have a file loaded
  const handleHorizonChange = (days) => {
    setHorizon(days);
    if (selectedFileId && dataFiles.length > 0) {
      runForecastForFile(selectedFileId, days);
    }
  };

  const handleRunForecast = () => runForecastForFile(selectedFileId, horizon);

  // ─── No files state ─────────────────────────────────────────────────────────
  if (loadingFiles) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  if (dataFiles.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="glass-card p-12 rounded-xl text-center">
          <Upload className="h-10 w-10 text-foreground-secondary mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No data uploaded yet</h2>
          <p className="text-sm text-foreground-secondary mb-6 max-w-md mx-auto">
            Upload your sales or inventory CSV to run real demand forecasting on your actual data.
          </p>
          <button onClick={() => navigate('/dashboard/data')} className="gradient-brand text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover-lift">
            Upload Data →
          </button>
        </div>
      </div>
    );
  }

  const trendIcon = metrics
    ? metrics.trendPct > 2 ? <TrendingUp className="h-4 w-4 text-success" />
      : metrics.trendPct < -2 ? <TrendingDown className="h-4 w-4 text-destructive" />
      : <Minus className="h-4 w-4 text-foreground-secondary" />
    : null;

  // Build per-SKU table
  const skuTableRows = allResults
    ? Object.entries(allResults)
        .filter(([sku]) => sku !== 'All Products')
        .map(([sku, result]) => ({
          sku,
          totalForecast: result.metrics?.totalForecast ?? '—',
          avgDaily: result.metrics?.avgDaily ?? '—',
          trendPct: result.metrics?.trendPct ?? null,
          r2: result.metrics?.r2 ?? null,
          dataPoints: result.metrics?.dataPoints ?? 0,
          error: result.error,
        }))
        .sort((a, b) => (b.totalForecast || 0) - (a.totalForecast || 0))
        .slice(0, 20)
    : [];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demand Forecasting</h1>
          <p className="text-sm text-foreground-secondary">
            Real predictions from your actual data · Trend + weekly seasonality model
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedFileId}
            onChange={(e) => setSelectedFileId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 max-w-[200px] truncate"
          >
            {dataFiles.map((f) => <option key={f.id} value={f.id}>{f.file_name}</option>)}
          </select>
          <select
            value={selectedSKU}
            onChange={(e) => setSelectedSKU(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 max-w-[180px]"
          >
            {skuList.map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex bg-muted rounded-lg p-0.5">
            {HORIZONS.map(({ label, days }) => (
              <button key={label} onClick={() => handleHorizonChange(days)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${horizon === days ? 'gradient-brand text-primary-foreground' : 'text-foreground-secondary hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRunForecast}
            disabled={running || !selectedFileId}
            className="gradient-brand text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover-lift disabled:opacity-50 flex items-center gap-2"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? 'Running...' : 'Run Forecast'}
          </button>
        </div>
      </div>

      {/* Metrics strip */}
      {metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: `Predicted Demand (${horizon}d)`, value: metrics.totalForecast.toLocaleString() + ' units', sub: `~${metrics.avgDaily}/day avg` },
            { label: 'Model Accuracy (R²)', value: `${metrics.r2}%`, sub: `RMSE ±${metrics.rmse} units`, highlight: metrics.r2 > 70 ? 'success' : metrics.r2 > 40 ? 'warning' : 'destructive' },
            { label: '30-Day Trend', value: `${metrics.trendPct > 0 ? '+' : ''}${metrics.trendPct}%`, sub: metrics.trendPct > 0 ? 'Growing demand' : metrics.trendPct < 0 ? 'Declining demand' : 'Stable demand' },
            { label: 'Peak Forecast Day', value: metrics.peakDay ? new Date(metrics.peakDay + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—', sub: metrics.peakValue ? `${metrics.peakValue} units` : '' },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-card p-4 rounded-xl">
              <p className="text-xs text-foreground-secondary mb-1">{item.label}</p>
              <p className={`text-xl font-bold ${item.highlight === 'success' ? 'text-success' : item.highlight === 'destructive' ? 'text-destructive' : 'text-foreground'}`}>
                {item.value}
              </p>
              {item.sub && <p className="text-xs text-foreground-secondary mt-0.5">{item.sub}</p>}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="glass-card p-4 rounded-xl">
              <div className="h-3 bg-muted rounded w-24 mb-2" />
              <div className="h-6 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Main forecast chart */}
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            Historical vs Forecast — {selectedSKU}
          </h3>
          {!allResults && !running && (
            <p className="text-xs text-foreground-secondary">Click "Run Forecast" to analyse your data</p>
          )}
        </div>

        {running ? (
          <div className="h-[350px] flex items-center justify-center">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-sm text-foreground-secondary">Downloading data and computing forecast…</p>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217,91%,60%)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))"
                  tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))" />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val, name) => [val != null ? val.toLocaleString() : '—', name]}
                />
                {/* Confidence band */}
                <Area type="monotone" dataKey="upper" stroke="none" fill="url(#confBand)" />
                <Area type="monotone" dataKey="lower" stroke="none" fill="transparent" />
                {/* Historical actual */}
                <Line type="monotone" dataKey="actual" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={false} name="Actual" />
                {/* Smoothed trend */}
                <Line type="monotone" dataKey="smoothed" stroke="hsl(38,92%,60%)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="7-day MA" />
                {/* Forecast */}
                <Line type="monotone" dataKey="forecast" stroke="hsl(263,70%,58%)" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Forecast" />
                {/* Today line */}
                <ReferenceLine x={new Date().toISOString().split('T')[0]} stroke="hsl(var(--border))" strokeDasharray="3 3" label={{ value: 'Today', position: 'top', fontSize: 10, fill: 'hsl(var(--foreground-secondary))' }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6 mt-4 justify-center flex-wrap">
              <span className="flex items-center gap-2 text-xs text-foreground-secondary">
                <span className="h-0.5 w-6 rounded" style={{ background: 'hsl(217,91%,60%)' }} /> Actual
              </span>
              <span className="flex items-center gap-2 text-xs text-foreground-secondary">
                <span className="h-0.5 w-6 rounded" style={{ background: 'hsl(38,92%,60%)', borderTop: '2px dashed' }} /> 7-day MA
              </span>
              <span className="flex items-center gap-2 text-xs text-foreground-secondary">
                <span className="h-0.5 w-6 rounded" style={{ background: 'hsl(263,70%,58%)', borderTop: '2px dashed' }} /> Forecast
              </span>
              <span className="flex items-center gap-2 text-xs text-foreground-secondary">
                <span className="h-3 w-6 rounded" style={{ background: 'hsl(217,91%,60%,0.1)' }} /> Confidence Band
              </span>
            </div>
          </>
        ) : (
          <div className="h-[350px] flex items-center justify-center border-2 border-dashed border-border rounded-xl">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 text-foreground-secondary/40 mx-auto mb-2" />
              <p className="text-sm text-foreground-secondary">Select a file and click "Run Forecast"</p>
            </div>
          </div>
        )}
      </div>

      {/* Weekly seasonality chart */}
      {metrics?.weeklyFactors && (
        <div className="glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Detected Weekly Demand Pattern</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={metrics.weeklyFactors} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--foreground-secondary))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                formatter={(v) => [`${(v * 100).toFixed(1)}% of average`, 'Seasonal factor']}
              />
              <ReferenceLine y={1} stroke="hsl(var(--border))" strokeDasharray="4 2" />
              <Bar dataKey="factor" radius={[4, 4, 0, 0]}>
                {metrics.weeklyFactors.map((entry, i) => (
                  <Cell key={i} fill={entry.factor >= 1 ? 'hsl(217,91%,60%)' : 'hsl(var(--foreground-secondary))'} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-foreground-secondary mt-2 text-center">
            Bars above 100% = above-average demand days · Used to modulate the forecast
          </p>
        </div>
      )}

      {/* Per-SKU table */}
      {skuTableRows.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Product Forecast Table — {horizon}-day outlook
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-elevated/50">
                  {['Product / SKU', `Forecast (${horizon}d)`, 'Avg / Day', 'Trend', 'Model Fit', 'Data Points'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skuTableRows.map((row) => (
                  <tr
                    key={row.sku}
                    onClick={() => setSelectedSKU(row.sku)}
                    className={`border-b border-border hover:bg-background-elevated/30 transition-colors cursor-pointer ${selectedSKU === row.sku ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">{row.sku}</td>
                    <td className="px-4 py-3 text-foreground-secondary">
                      {row.error ? <span className="text-xs text-warning">Insufficient data</span> : typeof row.totalForecast === 'number' ? row.totalForecast.toLocaleString() : row.totalForecast}
                    </td>
                    <td className="px-4 py-3 text-foreground-secondary">
                      {typeof row.avgDaily === 'number' ? row.avgDaily.toLocaleString() : row.avgDaily}
                    </td>
                    <td className="px-4 py-3">
                      {row.trendPct != null ? (
                        <span className={`text-xs font-semibold flex items-center gap-1 ${row.trendPct > 2 ? 'text-success' : row.trendPct < -2 ? 'text-destructive' : 'text-foreground-secondary'}`}>
                          {row.trendPct > 2 ? '▲' : row.trendPct < -2 ? '▼' : '→'}
                          {row.trendPct > 0 ? '+' : ''}{row.trendPct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.r2 != null ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.r2 > 70 ? 'bg-success/10 text-success' : row.r2 > 40 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                          R²={row.r2}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground-secondary text-xs">{row.dataPoints} rows</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border">
            <p className="text-xs text-foreground-secondary">Click a row to view its forecast chart above · R² &gt; 70% = good fit</p>
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      <div className="glass-card p-5 rounded-xl border-accent/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Ask AI About Your Forecast</h3>
          </div>
          <button onClick={openChat} className="text-sm text-primary font-medium flex items-center gap-1">
            Open Chat <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <p className="text-sm text-foreground-secondary mb-4">
          The AI assistant has context on your business and industry. Ask it to interpret these results or suggest actions.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            'Why might demand spike on certain days of the week?',
            'Which products should I reorder first based on trend?',
            'How do I improve my forecast model accuracy?',
          ].map((q) => (
            <button key={q} onClick={openChat}
              className="p-3 rounded-lg border border-accent/20 bg-accent/5 text-sm text-foreground-secondary text-left hover:bg-accent/10 transition-colors">
              "{q}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ForecastingPage;
