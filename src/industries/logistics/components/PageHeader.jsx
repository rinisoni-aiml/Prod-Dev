export default function PageHeader({ title, subtitle, icon }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
      </h1>
      {subtitle && <p className="text-sm text-foreground-secondary mt-1">{subtitle}</p>}
    </div>
  );
}
