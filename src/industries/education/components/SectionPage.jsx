import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader, AlertTriangle, Lightbulb, BarChart2 } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/stores/chatStore';
import { educationAnalyticsApi } from '../../../lib/api';
const COLORS = ['#3b82f6', '#10b981', '#070605ff', '#ef4444', '#8b5cf6', '#ec4899'];

export default function SectionPage({ section, title, description, icon: Icon }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { openChat } = useChatStore();
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, [section]);

const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await educationAnalyticsApi[`get${section.charAt(0).toUpperCase() + section.slice(1)}`]();
      const json = res.data;
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-foreground-secondary">{description}</p>
          </div>
        </div>
        <button
          onClick={openChat}
          className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium"
        >
          Ask AI
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-foreground-secondary ml-3">
            Analyzing your {section} data...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card p-6 rounded-xl border border-destructive/20 text-center">
          <p className="text-sm text-destructive mb-2">{error}</p>
          <button onClick={fetchData} className="text-sm text-primary underline">
            Try again
          </button>
        </div>
      )}

      {/* No data */}
      {!loading && !error && data?.charts?.length === 0 && (
        <div className="glass-card p-10 rounded-xl text-center space-y-3">
          <BarChart2 className="h-10 w-10 text-foreground-secondary mx-auto" />
          <p className="text-foreground font-medium">No {section} data found</p>
          <p className="text-sm text-foreground-secondary">
            Upload relevant Excel files from the Data Upload page to see analytics here.
          </p>
          <button
            onClick={() => navigate('/dashboard/data')}
            className="inline-block mt-2 px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium"
          >
            Upload Data →
          </button>
        </div>
      )}

      {/* Charts */}
      {!loading && !error && data?.charts?.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4">
          {data.charts.map((chart, i) => (
            <ChartCard key={i} chart={chart} delay={i * 0.1} />
          ))}
        </div>
      )}

      {/* Risks + Recommendations */}
      {!loading && !error && data &&
        (data.risks?.length > 0 || data.recommendations?.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">

          {data.risks?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-5 rounded-xl border border-destructive/20"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="text-sm font-semibold text-foreground">Risks Identified</h3>
              </div>
              <div className="space-y-3">
                {data.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                    <span className="h-5 w-5 rounded-full bg-destructive/20 text-destructive text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground-secondary">{risk}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {data.recommendations?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-5 rounded-xl border border-success/20"
            >
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-success" />
                <h3 className="text-sm font-semibold text-foreground">Recommendations</h3>
              </div>
              <div className="space-y-3">
                {data.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/10">
                    <span className="h-5 w-5 rounded-full bg-success/20 text-success text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground-secondary">{rec}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function ChartCard({ chart, delay }) {
  const rawData = Array.isArray(chart.data) ? chart.data : [];
  const chartData = rawData
    .filter(row => Array.isArray(row) && row.length >= 2)
    .map(row => ({
      name: String(row[0]),
      value: typeof row[1] === 'number'
        ? parseFloat(row[1].toFixed(1))
        : Number(row[1]) || 0,
    }));

  if (chartData.length === 0) return null;

  const CustomBarLabel = ({ x, y, width, value }) => (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="hsl(var(--foreground-secondary))"
      textAnchor="middle"
      fontSize={11}
      fontWeight={500}
    >
      {value}
    </text>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px'
        }}>
          <p style={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}>{label}</p>
          <p style={{ color: '#3b82f6' }}>Value: <strong>{payload[0].value}</strong></p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-5 rounded-xl"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">{chart.title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        {chart.chart === 'pie' ? (
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={4}
              label={({ name, value, percent }) =>
                `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={true}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        ) : (
          <BarChart
            data={chartData}
            margin={{ top: 25, right: 10, left: 10, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'hsl(var(--foreground-secondary))' }}
              stroke="hsl(var(--border))"
              angle={-35}
              textAnchor="end"
              interval={0}
              label={{
                value: chart.title.includes('Class') ? 'Class' :
                       chart.title.includes('Section') ? 'Section' :
                       chart.title.includes('Student') ? 'Student' : '',
                position: 'insideBottom',
                offset: -45,
                fontSize: 11,
                fill: 'hsl(var(--foreground-secondary))'
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--foreground-secondary))' }}
              stroke="hsl(var(--border))"
              label={{
                value: chart.title.includes('Marks') ? 'Marks' :
                       chart.title.includes('Attendance') ? 'Attendance %' :
                       chart.title.includes('Count') || chart.title.includes('Number') ? 'Count' : 'Value',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fontSize: 11,
                fill: 'hsl(var(--foreground-secondary))'
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="value"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              label={<CustomBarLabel />}
            />
          </BarChart>
        )}
      </ResponsiveContainer>

      {chart.chart === 'pie' && (
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          {chartData.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs text-foreground-secondary">
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {item.name}: <strong>{item.value}</strong>
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}