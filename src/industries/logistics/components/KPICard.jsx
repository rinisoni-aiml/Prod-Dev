export default function KPICard({ label, value, delta = '', deltaDir = 'neutral', icon = '', color = 'blue', valueColor = '' }) {
  const valueColors = {
    red: 'text-red-400', orange: 'text-orange-400', yellow: 'text-yellow-400',
    green: 'text-green-400', blue: 'text-blue-400', purple: 'text-purple-400',
    cyan: 'text-cyan-400', '': 'text-foreground',
  };
  const arrow = deltaDir === 'up' ? '↑' : deltaDir === 'dn' ? '↓' : '';
  const valCls = valueColors[valueColor] || valueColors[color] || 'text-foreground';

  return (
    <div className="glass-card rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-base">{icon}</span>}
        <span className="text-xs text-foreground-secondary font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${valCls}`}>{value ?? '--'}</div>
      {delta && (
        <div className="text-xs text-foreground-secondary mt-1">
          {arrow && <span className="mr-1">{arrow}</span>}{delta}
        </div>
      )}
    </div>
  );
}
