import { motion } from 'framer-motion';
import { Package, AlertTriangle, Target, Activity, TrendingUp, ArrowRight, X, Sparkles } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useInView } from 'react-intersection-observer';
import CountUp from 'react-countup';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { dashboardApi, alertsApi, aiApi } from '@/lib/api';
import { useChatStore } from '@/stores/chatStore';
import { fetchDataFiles } from '@/lib/dataFiles';

const iconMap = { Package, AlertTriangle, Target, Activity };

const SNAPSHOT_COLORS = {
  Optimal: 'hsl(160, 84%, 39%)',
  'Low Stock': 'hsl(38, 92%, 50%)',
  Stockout: 'hsl(0, 84%, 60%)',
  Overstock: 'hsl(217, 91%, 60%)',
};

const DashboardPage = () => {
  const { profile, user } = useAuthStore();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { openChat } = useChatStore();
  const [fileCount, setFileCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchDataFiles(user.id).then((files) => setFileCount(files.length)).catch(() => {});
  }, [user]);

  const enabled = !!user;

  const { data: kpis = [] } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => dashboardApi.getKPIs().then((r) => r.data),
    enabled,
  });

  const { data: demandTrend = [] } = useQuery({
    queryKey: ['dashboard-demand-trend'],
    queryFn: () => dashboardApi.getDemandTrend().then((r) => r.data),
    enabled,
  });

  const { data: topSKUs = [] } = useQuery({
    queryKey: ['dashboard-top-skus'],
    queryFn: () => dashboardApi.getTopSKUs().then((r) => r.data),
    enabled,
  });

  const { data: rawSnapshot = [] } = useQuery({
    queryKey: ['dashboard-inventory-snapshot'],
    queryFn: () => dashboardApi.getInventorySnapshot().then((r) => r.data),
    enabled,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.getAll().then((r) => r.data),
    enabled,
  });

  const { data: aiInsights = [] } = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () => aiApi.getInsights().then((r) => r.data),
    enabled,
  });

  const inventorySnapshot = rawSnapshot.map((s) => ({
    ...s,
    color: SNAPSHOT_COLORS[s.name] || 'hsl(var(--muted))',
  }));

  const activeAlerts = alerts.filter((a) => !a.is_resolved);
  const stockouts = activeAlerts.filter((a) => a.alert_type === 'stockout');
  const contractExpiries = activeAlerts.filter((a) => a.alert_type === 'contract_expiry');

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      {!bannerDismissed && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 rounded-xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Welcome, {profile?.full_name || 'User'}! Your FMCG workspace is ready. 🎉</h2>
            <p className="text-sm text-foreground-secondary mt-1">
              {profile?.company_name || 'Company'} · {fileCount} data source{fileCount !== 1 ? 's' : ''} uploaded
            </p>
          </div>
          <button onClick={() => setBannerDismissed(true)} className="text-foreground-secondary hover:text-foreground"><X className="h-5 w-5" /></button>
        </motion.div>
      )}

      {activeAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-destructive/10 to-warning/10 border border-destructive/20 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            ⚠️ <strong>{activeAlerts.length} Active Alert{activeAlerts.length !== 1 ? 's' : ''}:</strong>{' '}
            {stockouts.length > 0 && `${stockouts.length} Stockout${stockouts.length !== 1 ? 's' : ''}`}
            {stockouts.length > 0 && contractExpiries.length > 0 && ' · '}
            {contractExpiries.length > 0 && `${contractExpiries.length} Contract Expiring`}
          </p>
          <a href="/dashboard/contracts" className="text-sm text-primary font-medium flex items-center gap-1">View All <ArrowRight className="h-3 w-3" /></a>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = iconMap[kpi.icon] || Package;
          return <KPICard key={i} kpi={kpi} Icon={Icon} delay={i * 0.1} />;
        })}
        {kpis.length === 0 && [0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-5 rounded-xl animate-pulse">
            <div className="h-9 w-9 bg-muted rounded-lg mb-3" />
            <div className="h-7 w-16 bg-muted rounded mb-2" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Demand Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={demandTrend}>
              <defs>
                <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(187, 96%, 42%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(187, 96%, 42%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))" tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))" />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="units" name="Actual" stroke="hsl(217, 91%, 60%)" fill="url(#gradientArea)" strokeWidth={2} connectNulls={false} />
              <Area type="monotone" dataKey="forecast" name="Forecast" stroke="hsl(187, 96%, 42%)" fill="url(#gradientForecast)" strokeWidth={2} strokeDasharray="4 2" connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top 5 SKUs</h3>
          {topSKUs.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topSKUs} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} stroke="hsl(var(--foreground-secondary))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="units_sold" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-center">
              <p className="text-sm text-foreground-secondary">Upload sales data to see top SKUs</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Inventory Status</h3>
          {inventorySnapshot.some((s) => s.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={inventorySnapshot} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                    {inventorySnapshot.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {inventorySnapshot.map((s) => (
                  <span key={s.name} className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}: {s.value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-center">
              <p className="text-sm text-foreground-secondary">No inventory data yet — upload your data to see status</p>
            </div>
          )}
        </div>

        <div className="glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Live Alerts</h3>
          {activeAlerts.length > 0 ? (
            <div className="space-y-3 max-h-[250px] overflow-y-auto scrollbar-thin">
              {activeAlerts.map((alert, i) => (
                <motion.div key={alert.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className={`p-3 rounded-lg border ${alert.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : alert.severity === 'high' ? 'border-warning/30 bg-warning/5' : 'border-border'}`}>
                  <span className={`text-xs font-bold uppercase ${alert.severity === 'critical' ? 'text-destructive' : alert.severity === 'high' ? 'text-warning' : 'text-foreground-secondary'}`}>
                    {alert.severity}
                  </span>
                  <p className="text-sm text-foreground mt-1">{alert.message}</p>
                  <p className="text-xs text-foreground-secondary mt-1">{alert.sku} · {alert.warehouse}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-center">
              <p className="text-sm text-foreground-secondary">No active alerts — everything looks good</p>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-5 rounded-xl border-accent/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">AI Insights</h3>
          </div>
          <button onClick={openChat} className="text-sm text-primary font-medium flex items-center gap-1">
            Ask AI <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        {aiInsights.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            {aiInsights.map((insight, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.15 }}
                className="p-4 rounded-lg border border-accent/20 bg-accent/5">
                <p className="text-sm text-foreground leading-relaxed">{insight.description || insight.text}</p>
                {insight.confidence != null && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full gradient-ai rounded-full" style={{ width: `${insight.confidence}%` }} />
                    </div>
                    <span className="text-xs text-foreground-secondary">{insight.confidence}%</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-4 rounded-lg border border-accent/20 bg-accent/5 animate-pulse">
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function KPICard({ kpi, Icon, delay }) {
  const { ref, inView } = useInView({ triggerOnce: true });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay }}
      className="glass-card p-5 rounded-xl hover-lift">
      <div className="flex items-center justify-between mb-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="text-xs font-semibold text-foreground-secondary">
          <TrendingUp className="h-3 w-3 inline mr-1" />{kpi.trend}
        </span>
      </div>
      <div className="text-2xl font-bold text-foreground">
        {inView && <CountUp end={kpi.value} duration={2} decimals={kpi.suffix === '%' ? 1 : 0} />}
        {kpi.suffix || ''}
      </div>
      <p className="text-xs text-foreground-secondary mt-1">{kpi.label}</p>
    </motion.div>
  );
}

export default DashboardPage;
