import { motion } from 'framer-motion';
import {
  Users, Activity, Target, DollarSign,
  AlertTriangle, CheckCircle, Info, Sparkles, ArrowRight,
  X, Loader, RefreshCw, BookOpen, UserCheck, Briefcase,
  CreditCard, TrendingUp
} from 'lucide-react';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from 'recharts';
import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import CountUp from 'react-countup';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { educationDashboardApi } from '@/lib/api';

// ─── Config maps ─────────────────────────────────────────────────────

const SEVERITY = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/15 text-red-400',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" />,
    label: 'Critical',
    barColor: '#ef4444'
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    badge: 'bg-yellow-500/15 text-yellow-400',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />,
    label: 'Needs Attention',
    barColor: '#f59e0b'
  },
  positive: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    badge: 'bg-green-500/15 text-green-400',
    icon: <CheckCircle className="h-3.5 w-3.5 text-green-400" />,
    label: 'Good',
    barColor: '#10b981'
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/15 text-blue-400',
    icon: <Info className="h-3.5 w-3.5 text-blue-400" />,
    label: 'Info',
    barColor: '#3b82f6'
  }
};

const PRIORITY = {
  critical: {
    badge: 'bg-red-500/15 text-red-400 border border-red-500/30',
    label: '🔴 Critical'
  },
  high: {
    badge: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    label: '🟡 High'
  },
  medium: {
    badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    label: '🔵 Medium'
  }
};

const DOMAIN_ICON = {
  Academics:  <BookOpen  className="h-3.5 w-3.5" />,
  Attendance: <Activity  className="h-3.5 w-3.5" />,
  Admissions: <UserCheck className="h-3.5 w-3.5" />,
  Faculty:    <Users     className="h-3.5 w-3.5" />,
  Fees:       <CreditCard className="h-3.5 w-3.5" />,
  Placements: <Briefcase className="h-3.5 w-3.5" />,
};

const KPI_ICON = {
  users:    <Users      className="h-5 w-5" />,
  activity: <Activity   className="h-5 w-5" />,
  rupee:    <DollarSign className="h-5 w-5" />,
  target:   <Target     className="h-5 w-5" />,
};

const KPI_COLOR = {
  blue:   'bg-blue-500/10   text-blue-400',
  green:  'bg-green-500/10  text-green-400',
  yellow: 'bg-yellow-500/10 text-yellow-400',
  purple: 'bg-purple-500/10 text-purple-400',
};

const FILTERS = ['All', 'Academics', 'Attendance', 'Admissions', 'Faculty', 'Fees', 'Placements'];

// ─── Main Page ───────────────────────────────────────────────────────

const DashboardPage = () => {
  const { profile } = useAuthStore();
  const { openChat } = useChatStore();

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [data, setData]           = useState({ kpis: [], insights: [], recommendations: [] });
  const [kpiValues, setKpiValues] = useState({});
  const [insightCharts, setInsightCharts] = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await educationDashboardApi.getMainDashboard();
      const json = res.data;
      const parsed = json.dashboard || json;
      setData(parsed);

      const vals = {};
      (parsed.kpis || []).forEach(kpi => {
        vals[kpi.label] = kpi.value;
      });
      setKpiValues(vals);

      const charts = {};
      (parsed.insights || []).forEach(ins => {
        if (Array.isArray(ins.data) && ins.data.length > 0) {
          charts[ins.title] = ins.data.map(row => ({
            name:  String(row[0]),
            value: parseFloat(Number(row[1] ?? 0).toFixed(1))
          }));
        }
      });
      setInsightCharts(charts);

    } catch {
      setError('Could not load dashboard. Make sure your backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const filteredInsights = activeFilter === 'All'
    ? (data.insights || [])
    : (data.insights || []).filter(i => i.domain === activeFilter);

  const filteredRecs = activeFilter === 'All'
    ? (data.recommendations || [])
    : (data.recommendations || []).filter(r => r.domain === activeFilter);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">

      {/* Welcome Banner */}
      {!bannerDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 rounded-xl flex items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Welcome, {profile?.full_name || 'Admin'}! 👋
            </h2>
            <p className="text-sm text-foreground-secondary mt-1">
              {profile?.company_name || 'Your School'} · AI has analysed all your data · Last updated: just now
            </p>
          </div>
          <button onClick={() => setBannerDismissed(true)}>
            <X className="h-5 w-5 text-foreground-secondary hover:text-foreground" />
          </button>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-foreground-secondary">
            AI is analysing your school data across all domains...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card p-6 rounded-xl border border-destructive/20 text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 mx-auto text-sm text-primary underline"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* KPI Row */}
          {data.kpis?.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {data.kpis.map((kpi, i) => (
                <KPICard
                  key={i}
                  label={kpi.label}
                  value={kpiValues[kpi.label]}
                  icon={KPI_ICON[kpi.icon] || <Activity className="h-5 w-5" />}
                  colorClass={KPI_COLOR[kpi.color] || KPI_COLOR.blue}
                  delay={i * 0.1}
                />
              ))}
            </div>
          )}

          {/* Key Insights */}
          {filteredInsights.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Key Insights</h2>
                  <span className="text-xs text-foreground-secondary bg-muted px-2 py-0.5 rounded-full">
                    {filteredInsights.length} found
                  </span>
                </div>
                <button
                  onClick={openChat}
                  className="flex items-center gap-1 text-xs text-primary font-medium"
                >
                  Ask AI <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {filteredInsights.map((ins, i) => {
                  const sev       = SEVERITY[ins.severity] || SEVERITY.info;
                  const chartData = insightCharts[ins.title] || [];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={`glass-card rounded-xl p-5 border ${sev.border} ${sev.bg}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sev.badge}`}>
                          {sev.icon} {sev.label}
                        </span>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground-secondary">
                          {DOMAIN_ICON[ins.domain]} {ins.domain}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-foreground mt-3">
                        {ins.title}
                      </h3>
                      <p className="text-xs text-foreground-secondary mt-1 leading-relaxed">
                        {ins.detail}
                      </p>

                      {chartData.length > 1 && (
                        <div className="mt-4">
                          <ResponsiveContainer width="100%" height={130}>
                            <BarChart data={chartData} barSize={18}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 9 }}
                                stroke="hsl(var(--foreground-secondary))"
                              />
                              <YAxis
                                tick={{ fontSize: 9 }}
                                stroke="hsl(var(--foreground-secondary))"
                              />
                              <Tooltip
                                contentStyle={{
                                  background: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                  fontSize: '11px'
                                }}
                              />
                              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                                {chartData.map((_, idx) => (
                                  <Cell key={idx} fill={sev.barColor} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {filteredRecs.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Recommendations</h2>
                <span className="text-xs text-foreground-secondary bg-muted px-2 py-0.5 rounded-full">
                  {filteredRecs.length} actions
                </span>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                {filteredRecs.map((rec, i) => {
                  const pri = PRIORITY[rec.priority] || PRIORITY.medium;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="glass-card rounded-xl p-5 border border-border"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pri.badge}`}>
                          {pri.label}
                        </span>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground-secondary">
                          {DOMAIN_ICON[rec.domain]} {rec.domain}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-foreground">{rec.title}</h3>
                      <p className="text-xs text-foreground-secondary mt-1 leading-relaxed">{rec.detail}</p>

                      <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                        <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <p className="text-xs text-primary font-medium">{rec.action}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty state */}
          {filteredInsights.length === 0 && filteredRecs.length === 0 && (
            <div className="glass-card p-10 rounded-xl text-center">
              <p className="text-foreground font-medium">No data found</p>
              <p className="text-sm text-foreground-secondary mt-2">
                Please upload your school Excel files first from the Data Upload page.
              </p>
              
                href="/dashboard/data"
                className="mt-4 inline-block text-sm text-primary font-medium underline"
              
                Go to Data Upload →
              
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────

function KPICard({ label, value, icon, colorClass, delay }) {
  const { ref, inView } = useInView({ triggerOnce: true });
  const numericValue    = parseFloat(value);
  const isNumber        = !isNaN(numericValue);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay }}
      className="glass-card p-5 rounded-xl hover-lift"
    >
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${colorClass}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-foreground">
        {inView && isNumber ? (
          <CountUp
            end={numericValue}
            duration={2}
            decimals={numericValue % 1 !== 0 ? 1 : 0}
            separator=","
          />
        ) : (
          value ?? '—'
        )}
      </div>
      <p className="text-xs text-foreground-secondary mt-1">{label}</p>
    </motion.div>
  );
}

export default DashboardPage;