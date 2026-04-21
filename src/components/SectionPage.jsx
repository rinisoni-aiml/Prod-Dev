const SectionPage = ({ section, title, description, icon: Icon }) => {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-2">
        {Icon && <Icon className="h-6 w-6 text-primary" />}
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
      )}
      <div className="glass-card rounded-xl p-10 text-center border border-border">
        <p className="text-foreground font-medium">Coming Soon</p>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </div>
    </div>
  );
};

export default SectionPage;