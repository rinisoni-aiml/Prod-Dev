import { useState } from 'react';
import { motion } from 'framer-motion';
import { ComposedChart, Line, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { Sparkles, ArrowRight } from 'lucide-react';
import { mockForecastData, mockTopSKUs } from '@/lib/mockData';
import { useChatStore } from '@/stores/chatStore';

const ForecastingPage = () => {
  const [horizon, setHorizon] = useState('30d');
  const [selectedSKU, setSelectedSKU] = useState('All Products');
  const { openChat } = useChatStore();

  const forecastSummary = [
    { label: 'Predicted Demand', value: '12,450 units', trend: '+8%' },
    { label: 'Confidence Score', value: '89.3%', trend: '+2.1%' },
    { label: 'Peak Day', value: 'Mar 15', trend: '' },
    { label: 'Seasonal Index', value: '1.23x', trend: '+0.15' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demand Forecasting</h1>
          <p className="text-sm text-foreground-secondary">AI-powered predictions from your real data</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedSKU} onChange={(e) => setSelectedSKU(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option>All Products</option>
            {mockTopSKUs.map(s => <option key={s.name}>{s.name}</option>)}
          </select>
          <div className="flex bg-muted rounded-lg p-0.5">
            {['7d', '30d', '90d'].map((h) => (
              <button key={h} onClick={() => setHorizon(h)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${horizon === h ? 'gradient-brand text-primary-foreground' : 'text-foreground-secondary hover:text-foreground'}`}>
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {forecastSummary.map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-card p-4 rounded-xl">
            <p className="text-xs text-foreground-secondary mb-1">{item.label}</p>
            <p className="text-xl font-bold text-foreground">{item.value}</p>
            {item.trend && <span className="text-xs text-success font-medium">{item.trend}</span>}
          </motion.div>
        ))}
      </div>

      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Historical vs Forecast</h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={mockForecastData}>
            <defs>
              <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.1} />
                <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))" tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))" />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="url(#confBand)" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="transparent" />
            <Line type="monotone" dataKey="actual" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="forecast" stroke="hsl(263, 70%, 58%)" strokeWidth={2} strokeDasharray="6 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-6 mt-4 justify-center">
          <span className="flex items-center gap-2 text-xs text-foreground-secondary">
            <span className="h-0.5 w-6 bg-primary rounded" /> Historical
          </span>
          <span className="flex items-center gap-2 text-xs text-foreground-secondary">
            <span className="h-0.5 w-6 bg-accent rounded" style={{ borderTop: '2px dashed' }} /> Forecast
          </span>
          <span className="flex items-center gap-2 text-xs text-foreground-secondary">
            <span className="h-3 w-6 bg-primary/10 rounded" /> Confidence Band
          </span>
        </div>
      </div>

      <div className="glass-card p-5 rounded-xl border-accent/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">AI Recommendations</h3>
          </div>
          <button onClick={openChat} className="text-sm text-primary font-medium flex items-center gap-1">
            Deep Dive <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            'Increase Wheat Flour 5kg reorder by 20% for next week — seasonal demand spike predicted.',
            'Consider redistributing Sugar 1kg stock from Bangalore to Mumbai warehouse to prevent stockout.',
            'Sunflower Oil 1L forecast shows stable demand. Maintain current reorder levels.',
          ].map((rec, i) => (
            <div key={i} className="p-4 rounded-lg border border-accent/20 bg-accent/5">
              <p className="text-sm text-foreground">{rec}</p>
              <button className="mt-3 text-xs text-primary font-medium">Mark as Actioned ✓</button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Product Forecast Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background-elevated/50">
                {['Product', 'Current Sales', 'Forecast (30d)', 'Trend', 'Confidence', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockTopSKUs.map((sku, i) => (
                <tr key={sku.name} className="border-b border-border hover:bg-background-elevated/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{sku.name}</td>
                  <td className="px-4 py-3 text-foreground-secondary">{sku.units_sold.toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground-secondary">{Math.floor(sku.units_sold * 1.08).toLocaleString()}</td>
                  <td className="px-4 py-3 text-success text-xs font-medium">+{(Math.random() * 15 + 2).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-foreground-secondary">{(85 + Math.random() * 10).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${i < 2 ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                      {i < 2 ? 'Growing' : 'Stable'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ForecastingPage;
