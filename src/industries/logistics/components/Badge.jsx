export default function Badge({ text, level = 'info' }) {
  const styles = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low:      'bg-green-500/20 text-green-400 border-green-500/30',
    info:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  const cls = styles[String(level).toLowerCase()] || styles.info;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {text}
    </span>
  );
}
