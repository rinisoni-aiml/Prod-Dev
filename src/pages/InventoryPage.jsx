import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, PieChart, Pie, Cell, RadialBarChart, RadialBar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Package, Warehouse, AlertTriangle, Sparkles } from 'lucide-react';
import { mockWarehouses, mockReorderQueue, mockABCAnalysis, mockInventorySnapshot } from '@/lib/mockData';

const InventoryPage = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'warehouses', label: 'Warehouse View' },
    { id: 'reorder', label: 'Reorder Queue' },
    { id: 'abc', label: 'ABC Analysis' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-sm text-foreground-secondary">Real-time inventory intelligence</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === id ? 'gradient-brand text-primary-foreground shadow-sm' : 'text-foreground-secondary hover:text-foreground'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'warehouses' && <WarehouseTab />}
      {activeTab === 'reorder' && <ReorderTab />}
      {activeTab === 'abc' && <ABCTab />}
    </div>
  );
};

function OverviewTab() {
  const statusCards = [
    { label: 'Optimal Stock', value: 156, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Low Stock', value: 52, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'Stockout', value: 18, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Overstock', value: 21, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const healthData = [{ name: 'Health', value: 74, fill: 'hsl(217, 91%, 60%)' }];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statusCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="glass-card p-5 rounded-xl hover-lift">
            <p className="text-xs text-foreground-secondary mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Inventory Health Score</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={healthData} startAngle={180} endAngle={0}>
              <RadialBar dataKey="value" cornerRadius={10} fill="hsl(217, 91%, 60%)" background={{ fill: 'hsl(var(--muted))' }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-center text-3xl font-bold text-foreground -mt-16">74<span className="text-lg text-foreground-secondary">/100</span></p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribution by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={mockInventorySnapshot} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                {mockInventorySnapshot.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function WarehouseTab() {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-elevated/50">
              {['Warehouse', 'Total SKUs', 'Stockouts', 'Fill Rate', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockWarehouses.map((wh) => (
              <tr key={wh.id} className="border-b border-border hover:bg-background-elevated/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                  <Warehouse className="h-4 w-4 text-foreground-secondary" /> {wh.name}
                </td>
                <td className="px-4 py-3 text-foreground-secondary">{wh.total_skus}</td>
                <td className="px-4 py-3"><span className={wh.stockouts > 5 ? 'text-destructive font-medium' : 'text-foreground-secondary'}>{wh.stockouts}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${wh.fill_rate > 80 ? 'bg-success' : wh.fill_rate > 65 ? 'bg-warning' : 'bg-destructive'}`} style={{ width: `${wh.fill_rate}%` }} />
                    </div>
                    <span className="text-xs text-foreground-secondary">{wh.fill_rate}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    wh.status === 'good' ? 'bg-success/10 text-success' : wh.status === 'warning' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                  }`}>{wh.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReorderTab() {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background-elevated/50">
              {['SKU', 'Product', 'Stock', 'Daily Avg', 'Days Left', 'Urgency', 'Warehouse', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockReorderQueue.map((item) => (
              <tr key={item.sku} className="border-b border-border hover:bg-background-elevated/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-foreground-secondary">{item.sku}</td>
                <td className="px-4 py-3 font-medium text-foreground">{item.product}</td>
                <td className="px-4 py-3 text-foreground-secondary">{item.current_stock}</td>
                <td className="px-4 py-3 text-foreground-secondary">{item.daily_avg}/day</td>
                <td className="px-4 py-3"><span className={item.days_left < 3 ? 'text-destructive font-bold' : 'text-foreground-secondary'}>{item.days_left.toFixed(1)}d</span></td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.urgency === 'critical' ? 'bg-destructive/10 text-destructive' : item.urgency === 'high' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
                  }`}>{item.urgency}</span>
                </td>
                <td className="px-4 py-3 text-foreground-secondary">{item.warehouse}</td>
                <td className="px-4 py-3">
                  <button className="px-3 py-1 rounded-lg text-xs font-medium gradient-brand text-primary-foreground hover-lift">Create PO</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ABCTab() {
  const colors = ['hsl(217, 91%, 60%)', 'hsl(187, 96%, 42%)', 'hsl(var(--muted-foreground))'];
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {mockABCAnalysis.map((cat, i) => (
          <div key={cat.category} className="glass-card p-5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-foreground">Category {cat.category}</span>
              <span className="text-xs text-foreground-secondary">{cat.description}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{cat.count} SKUs</p>
            <p className="text-sm text-foreground-secondary">{cat.revenue_pct}% of revenue</p>
          </div>
        ))}
      </div>
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Distribution by Category</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={mockABCAnalysis}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="category" stroke="hsl(var(--foreground-secondary))" tick={{ fontSize: 12 }} />
            <YAxis stroke="hsl(var(--foreground-secondary))" tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            <Bar dataKey="revenue_pct" radius={[6, 6, 0, 0]}>
              {mockABCAnalysis.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default InventoryPage;
