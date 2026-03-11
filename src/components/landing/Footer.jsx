import Logo from '@/components/Logo';

const Footer = () => {
  const columns = [
    { title: 'Platform', links: ['Features', 'Industries', 'Integrations', 'Pricing'] },
    { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
    { title: 'Resources', links: ['Documentation', 'API Reference', 'Status', 'Changelog'] },
  ];
  return (
    <footer className="border-t border-border bg-background-surface py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12">
          <div><Logo size="sm" /><p className="text-sm text-foreground-secondary mt-3">The AI Layer That Understands Your Business.</p></div>
          {columns.map((col) => (<div key={col.title}><h4 className="text-sm font-semibold text-foreground mb-4">{col.title}</h4><ul className="space-y-2">{col.links.map((link) => (<li key={link}><a href="#" className="text-sm text-foreground-secondary hover:text-foreground transition-colors">{link}</a></li>))}</ul></div>))}
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-foreground-secondary">© 2025 PulseIQ. All rights reserved.</p>
          <div className="flex items-center gap-6"><a href="#" className="text-sm text-foreground-secondary hover:text-foreground">Privacy</a><a href="#" className="text-sm text-foreground-secondary hover:text-foreground">Terms</a><a href="#" className="text-sm text-foreground-secondary hover:text-foreground">Security</a></div>
        </div>
      </div>
    </footer>
  );
};
export default Footer;
