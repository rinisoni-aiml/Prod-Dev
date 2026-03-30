export default function PageHeader({ title, subtitle, icon }) {
  return (
    <div className="page-header">
      <h1 className="page-title">
        {icon && <span>{icon}</span>}
        {title}
      </h1>
      {subtitle && <div className="page-subtitle">{subtitle}</div>}
    </div>
  );
}
