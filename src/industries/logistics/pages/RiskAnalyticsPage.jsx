import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { logisticsApi } from '@/industries/logistics/api/logisticsApi';
import { formatPercent } from '@/industries/logistics/utils/logistics';

function getRiskColor(score) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 30) return '#eab308';
  return '#10b981';
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function RiskAnalyticsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['logistics-risk-analytics'],
    queryFn: () => logisticsApi.getRiskAnalyticsView(),
    select: (res) => res?.data || {},
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Risk Analytics</h1>
          <p className="text-sm text-foreground-secondary mt-1">Route risk distribution, vendor comparison, and trends</p>
        </div>
        <div className="glass-card rounded-xl p-8 text-center border border-border">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-foreground-secondary text-sm">Loading risk analytics...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Risk Analytics</h1>
        </div>
        <div className="glass-card rounded-xl p-8 text-center border border-destructive/30">
          <p className="text-destructive text-sm">{error?.message || 'Failed to load risk analytics.'}</p>
        </div>
      </div>
    );
  }

  const topRoutes = data?.top_routes || [];
  const vendorRisk = data?.vendor_comparison || [];
  const marketVolatility = data?.market_volatility || [];
  const contributors = data?.contributors || [];
  const insightText = data?.insight_text || '';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">📈 Risk Analytics</h1>
        <p className="text-sm text-foreground-secondary mt-1">Route risk distribution, vendor comparison, and trends</p>
      </div>

      {/* Top row — Highest-risk routes + Risk weights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Highest-risk routes */}
        <div className="lg:col-span-2 glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Highest-Risk Routes</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">Average risk by corridor</p>
          </div>
          <div className="p-5">
            {topRoutes.length === 0 ? (
              <div className="py-8 text-center text-foreground-secondary text-sm">No route data available. Upload shipment data to see risk by corridor.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, topRoutes.length * 40)}>
                <BarChart data={topRoutes} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="risk_score" name="Risk Score" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#94a3b8', formatter: (v) => v.toFixed(1) }}>
                    {topRoutes.map((route, i) => (
                      <Cell key={i} fill={getRiskColor(route.risk_score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Risk weight contributors */}
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Current Risk Weights</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">Active scoring configuration</p>
          </div>
          <div className="p-5 space-y-5">
            {contributors.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between mb-1.5 text-xs">
                  <span className="text-foreground-secondary">{item.name}</span>
                  <span className="text-blue-400 font-bold">{formatPercent(item.contribution_pct || 0, 0)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400 transition-all duration-500"
                    style={{ width: `${Math.max(4, Number(item.contribution_pct || 0))}%` }} />
                </div>
              </div>
            ))}
            {insightText && (
              <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-400 text-sm">ℹ</span>
                  <span className="text-xs font-semibold text-blue-400">Interpretation</span>
                </div>
                <p className="text-xs text-foreground-secondary leading-relaxed">
                  Operational and financial weights currently carry the largest planning impact. {insightText}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row — Vendor comparison + Market volatility */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor risk comparison */}
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Vendor Risk Comparison</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">Risk score by carrier</p>
          </div>
          <div className="p-5">
            {vendorRisk.length === 0 ? (
              <div className="py-8 text-center text-foreground-secondary text-sm">No vendor data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vendorRisk.slice(0, 12)} margin={{ left: 0, right: 10, top: 4, bottom: 60 }}>
                  <XAxis dataKey="vendor_name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} angle={-40} textAnchor="end" interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} label={{ value: 'Risk Score', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94a3b8' } }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="risk_score" name="Risk Score" radius={[4, 4, 0, 0]}>
                    {vendorRisk.slice(0, 12).map((v, i) => (
                      <Cell key={i} fill={getRiskColor(v.risk_score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Market volatility hotspots */}
        <div className="glass-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Market Volatility Hotspots</h2>
            <p className="text-xs text-foreground-secondary mt-0.5">Average volatility index by route</p>
          </div>
          <div className="p-5">
            {marketVolatility.length === 0 ? (
              <div className="py-8 text-center text-foreground-secondary text-sm">No market intelligence data available. Upload market freight data to see volatility.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={marketVolatility} margin={{ left: 0, right: 10, top: 4, bottom: 60 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="volatility" name="Volatility" fill="#63b3ed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
