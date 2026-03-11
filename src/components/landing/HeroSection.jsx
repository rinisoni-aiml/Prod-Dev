import { motion } from 'framer-motion';
import { ArrowRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </div>
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-8">
          <span className="text-primary text-sm">✦</span>
          <span className="text-sm font-medium text-foreground-secondary">AI-Powered Business Intelligence · Now in Early Access</span>
          <span className="shimmer absolute inset-0 rounded-full" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
          Turn Your Business Data<br /><span className="gradient-text-brand">Into Strategic Intelligence</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-lg md:text-xl text-foreground-secondary max-w-[680px] mx-auto mb-10">
          An AI-powered enterprise platform that connects to your CRM, ERP, documents, emails, and internal systems — and transforms them into actionable, explainable business insights.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link to="/signup" className="gradient-brand text-primary-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover-lift flex items-center gap-2 shadow-lg">Request Early Access <ArrowRight className="h-5 w-5" /></Link>
          <a href="#process" className="border border-border bg-background-surface/50 px-8 py-3.5 rounded-xl text-base font-medium text-foreground hover-lift">Schedule a Demo</a>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="flex items-center justify-center gap-4 text-sm text-foreground-secondary">
          <Shield className="h-4 w-4 text-success" /><span>Enterprise-grade security · No data shared externally · Deploy in days</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.8 }} className="mt-16 relative">
          <div className="glass-card p-6 rounded-2xl shadow-2xl animate-float" style={{ animationDuration: '8s' }}>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {['247 SKUs', '18 Alerts', '89.3% Accuracy', '74/100 Health'].map((text, i) => (
                <div key={i} className="bg-background-elevated rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-foreground">{text.split(' ')[0]}</div>
                  <div className="text-xs text-foreground-secondary">{text.split(' ').slice(1).join(' ')}</div>
                </div>
              ))}
            </div>
            <div className="h-32 bg-background-elevated rounded-lg flex items-center justify-center">
              <div className="flex items-end gap-1 h-20">
                {Array.from({ length: 20 }, (_, i) => (<div key={i} className="w-3 rounded-t gradient-brand opacity-60" style={{ height: `${20 + Math.sin(i / 3) * 40 + Math.random() * 20}%` }} />))}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-primary/20 blur-3xl rounded-full" />
        </motion.div>
      </div>
    </section>
  );
};
export default HeroSection;
