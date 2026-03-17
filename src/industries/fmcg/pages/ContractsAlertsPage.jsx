import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Calendar, DollarSign, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { alertsApi, contractsApi } from '@/lib/api';
import toast from 'react-hot-toast';

const ContractsAlertsPage = () => {
  const [mainTab, setMainTab] = useState('alerts');

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contracts & Alerts</h1>
          <p className="text-sm text-foreground-secondary">Manage alerts and vendor contracts</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setMainTab('alerts')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mainTab === 'alerts' ? 'gradient-brand text-primary-foreground' : 'text-foreground-secondary hover:text-foreground'}`}>
          Alerts
        </button>
        <button onClick={() => setMainTab('contracts')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mainTab === 'contracts' ? 'gradient-brand text-primary-foreground' : 'text-foreground-secondary hover:text-foreground'}`}>
          Contracts
        </button>
      </div>

      {mainTab === 'alerts' ? <AlertsTab /> : <ContractsTab />}
    </div>
  );
};

function AlertsTab() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const filters = ['all', 'critical', 'high', 'medium', 'low', 'resolved'];

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.getAll().then((r) => r.data),
    enabled: !!user,
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => alertsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert resolved');
    },
    onError: () => toast.error('Failed to resolve alert'),
  });

  const filtered =
    filter === 'all' ? alerts.filter((a) => !a.is_resolved)
    : filter === 'resolved' ? alerts.filter((a) => a.is_resolved)
    : alerts.filter((a) => a.severity === filter && !a.is_resolved);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-card p-5 rounded-xl animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-2" />
            <div className="h-4 bg-muted rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === f ? 'gradient-brand text-primary-foreground' : 'bg-muted text-foreground-secondary hover:text-foreground'
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass-card p-12 rounded-xl text-center">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground">All clear!</p>
            <p className="text-sm text-foreground-secondary">No alerts in this category.</p>
          </div>
        ) : filtered.map((alert, i) => (
          <motion.div key={alert.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`glass-card p-5 rounded-xl border-l-4 ${
              alert.severity === 'critical' ? 'border-l-destructive' : alert.severity === 'high' ? 'border-l-warning' : 'border-l-primary'
            }`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                    alert.severity === 'critical' ? 'bg-destructive/10 text-destructive' : alert.severity === 'high' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'
                  }`}>{alert.severity}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground-secondary">{alert.alert_type.replace('_', ' ')}</span>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">{alert.message}</p>
                <p className="text-xs text-foreground-secondary">{alert.sku} · {alert.warehouse} · {new Date(alert.created_at).toLocaleString()}</p>
              </div>
              {!alert.is_resolved && (
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => resolveMutation.mutate(alert.id)}
                    disabled={resolveMutation.isPending}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors disabled:opacity-50">
                    Mark Resolved
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ContractsTab() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContract, setNewContract] = useState({
    contract_name: '', vendor: '', start_date: '', end_date: '', value: '', notes: '',
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => contractsApi.getAll().then((r) => r.data),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => contractsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowAddModal(false);
      setNewContract({ contract_name: '', vendor: '', start_date: '', end_date: '', value: '', notes: '' });
      toast.success('Contract added');
    },
    onError: () => toast.error('Failed to add contract'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => contractsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract deleted');
    },
    onError: () => toast.error('Failed to delete contract'),
  });

  const stats = [
    { label: 'Total Active', value: contracts.filter((c) => c.status === 'active').length, icon: FileText },
    { label: 'Expiring in 30 Days', value: contracts.filter((c) => c.status === 'expiring_soon').length, icon: Clock, warn: true },
    { label: 'Total Value', value: `₹${(contracts.reduce((s, c) => s + (c.value || 0), 0) / 100000).toFixed(1)}L`, icon: DollarSign },
  ];

  const handleAdd = () => {
    if (!newContract.contract_name || !newContract.vendor || !newContract.start_date || !newContract.end_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate({
      ...newContract,
      value: parseFloat(newContract.value) || 0,
      status: 'active',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card p-4 rounded-xl animate-pulse">
              <div className="h-3 bg-muted rounded w-20 mb-3" />
              <div className="h-7 bg-muted rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, warn }) => (
          <div key={label} className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${warn ? 'text-warning' : 'text-primary'}`} />
              <span className="text-xs text-foreground-secondary">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${warn ? 'text-warning' : 'text-foreground'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowAddModal(true)}
          className="gradient-brand text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover-lift flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Contract
        </button>
      </div>

      {contracts.length === 0 ? (
        <div className="glass-card p-12 rounded-xl text-center">
          <FileText className="h-10 w-10 text-foreground-secondary mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground mb-2">No contracts yet</p>
          <p className="text-sm text-foreground-secondary">Add your first vendor contract to track it here.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background-elevated/50">
                  {['Contract', 'Vendor', 'Start', 'End', 'Value', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id} className={`border-b border-border transition-colors ${
                    contract.status === 'expired' ? 'opacity-60' : contract.status === 'expiring_soon' ? 'bg-warning/5' : ''
                  } hover:bg-background-elevated/30`}>
                    <td className="px-4 py-3 font-medium text-foreground">{contract.contract_name}</td>
                    <td className="px-4 py-3 text-foreground-secondary">{contract.vendor}</td>
                    <td className="px-4 py-3 text-foreground-secondary">{contract.start_date}</td>
                    <td className="px-4 py-3 text-foreground-secondary">{contract.end_date}</td>
                    <td className="px-4 py-3 text-foreground">₹{((contract.value || 0) / 100000).toFixed(1)}L</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        contract.status === 'active' ? 'bg-success/10 text-success'
                          : contract.status === 'expiring_soon' ? 'bg-warning/10 text-warning'
                          : 'bg-destructive/10 text-destructive'
                      }`}>{contract.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteMutation.mutate(contract.id)}
                        disabled={deleteMutation.isPending}
                        className="text-xs text-destructive hover:underline disabled:opacity-50">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add Contract</h3>
              <button onClick={() => setShowAddModal(false)}><X className="h-5 w-5 text-foreground-secondary" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Contract Name', key: 'contract_name', type: 'text' },
                { label: 'Vendor', key: 'vendor', type: 'text' },
                { label: 'Start Date', key: 'start_date', type: 'date' },
                { label: 'End Date', key: 'end_date', type: 'date' },
                { label: 'Value (₹)', key: 'value', type: 'number' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-foreground-secondary mb-1 block">{label}</label>
                  <input type={type}
                    value={newContract[key]}
                    onChange={(e) => setNewContract({ ...newContract, [key]: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-foreground-secondary mb-1 block">Notes</label>
                <textarea value={newContract.notes} onChange={(e) => setNewContract({ ...newContract, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" rows={3} />
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={createMutation.isPending}
              className="w-full gradient-brand text-primary-foreground py-2.5 rounded-lg font-semibold text-sm mt-4 hover-lift disabled:opacity-50">
              {createMutation.isPending ? 'Saving...' : 'Save Contract'}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default ContractsAlertsPage;
