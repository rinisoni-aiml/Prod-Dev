import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import {
  Link2, FileText, Brain, AlertTriangle, TrendingUp, MessageSquare,
  Shield, Lock, Users, ClipboardList, ServerOff, Zap, ArrowRight,
  Check, X, Factory, GraduationCap, Activity, Building2, Truck,
  CreditCard, Database, Cpu,
} from 'lucide-react';
import StatCounter from '@/components/StatCounter';
import { Link } from 'react-router-dom';

const SectionLabel = ({ children }) => (
  <span className="text-xs font-bold uppercase tracking-[0.2em] text-secondary mb-4 block">{children}</span>
);

/* ─── Section order: Industries moved BEFORE Integrations ─── */
const LandingSections = () => (
  <div className="relative">
    <ProblemSection />
    <SolutionSection />
    <IndustriesSection />
    <IntegrationsSection />
    <CapabilitiesSection />
    <ProcessSection />
    <SecuritySection />
    <DifferentiationSection />
    <VisionSection />
    <CTASection />
  </div>
);

/* ══════════════════════════════════════════════════════════════
   PROBLEM SECTION — Powerful redesign with gradient borders
══════════════════════════════════════════════════════════════ */
function ProblemSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const haveItems = [
    { icon: Users, text: 'CRM records' },
    { icon: Cpu, text: 'ERP transactions' },
    { icon: MessageSquare, text: 'Emails & transcripts' },
    { icon: FileText, text: 'PDFs & reports' },
    { icon: TrendingUp, text: 'Dashboards' },
    { icon: Database, text: 'Databases' },
  ];
  const decisionItems = ['Manual reports', 'Fragmented dashboards', 'Reactive analysis', 'Expensive consultants'];

  return (
    <section ref={ref} className="py-32 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute top-1/2 left-[20%] w-[500px] h-[500px] rounded-full blur-3xl -translate-y-1/2 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 right-[20%] w-[500px] h-[500px] rounded-full blur-3xl -translate-y-1/2 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.07) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Heading */}
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8 }}>
          <SectionLabel>THE CHALLENGE</SectionLabel>
          <h2 className="text-5xl md:text-6xl font-bold text-foreground leading-tight mb-4">
            Businesses Have Data.<br />
            <span className="text-foreground/50 font-normal">But They Don't Have </span>
            <span className="gradient-text-brand">Intelligence.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-[1fr_60px_1fr] gap-6 items-start">

          {/* LEFT — What you have */}
          <div>
            <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.2 }}
              className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-5">What you have</motion.p>
            <div className="space-y-2.5">
              {haveItems.map(({ icon: Icon, text }, i) => (
                <motion.div key={text}
                  initial={{ opacity: 0, x: -50 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.25 + i * 0.07, duration: 0.5 }}
                  className="group relative overflow-hidden rounded-xl p-4 flex items-center gap-4 hover-lift cursor-default"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.03) 100%)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    borderLeft: '3px solid rgba(59,130,246,0.7)',
                    boxShadow: '0 2px 20px rgba(59,130,246,0.06)',
                  }}>
                  {/* Hover shimmer */}
                  <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.06), transparent)' }} />
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 relative z-10"
                    style={{ background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)', boxShadow: '0 0 14px rgba(59,130,246,0.25)' }}>
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground relative z-10">{text}</span>
                  {/* Right glow dot */}
                  <div className="ml-auto h-1.5 w-1.5 rounded-full flex-shrink-0 relative z-10"
                    style={{ background: 'rgba(59,130,246,0.5)' }} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* CENTRE divider with pulsing X */}
          <div className="hidden md:flex flex-col items-center justify-start pt-12 gap-2">
            <motion.div className="w-px flex-1 min-h-[70px]"
              initial={{ scaleY: 0 }} animate={inView ? { scaleY: 1 } : {}} transition={{ delay: 0.5, duration: 0.6 }}
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(239,68,68,0.5))', transformOrigin: 'top' }} />
            <motion.div
              initial={{ opacity: 0, scale: 0 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.7, type: 'spring', stiffness: 200 }}
              className="relative flex items-center justify-center flex-shrink-0">
              {/* Pulsing rings */}
              <motion.div className="absolute rounded-full"
                animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{ width: 44, height: 44, background: 'rgba(239,68,68,0.15)', borderRadius: '50%' }} />
              <motion.div className="absolute rounded-full"
                animate={{ scale: [1, 2.2, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 0.4 }}
                style={{ width: 44, height: 44, background: 'rgba(239,68,68,0.08)', borderRadius: '50%' }} />
              <div className="h-11 w-11 rounded-full flex items-center justify-center relative z-10"
                style={{ background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 0 20px rgba(239,68,68,0.2)' }}>
                <X className="h-5 w-5" style={{ color: 'hsl(0,84%,60%)' }} />
              </div>
            </motion.div>
            <motion.div className="w-px flex-1 min-h-[70px]"
              initial={{ scaleY: 0 }} animate={inView ? { scaleY: 1 } : {}} transition={{ delay: 0.5, duration: 0.6 }}
              style={{ background: 'linear-gradient(to bottom, rgba(239,68,68,0.5), transparent)', transformOrigin: 'bottom' }} />
          </div>

          {/* RIGHT — How decisions get made */}
          <div>
            <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.3 }}
              className="text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: 'hsl(0,84%,60%)' }}>
              How decisions get made</motion.p>
            <div className="space-y-2.5">
              {decisionItems.map((item, i) => (
                <motion.div key={item}
                  initial={{ opacity: 0, x: 50 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.07, duration: 0.5 }}
                  className="group relative overflow-hidden rounded-xl p-4 hover-lift cursor-default"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.09) 0%, rgba(239,68,68,0.02) 100%)',
                    border: '1px solid rgba(239,68,68,0.18)',
                    borderLeft: '3px solid rgba(239,68,68,0.55)',
                  }}>
                  <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                    style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.05), transparent)' }} />
                  <span className="text-sm text-foreground-secondary relative z-10">{item}</span>
                </motion.div>
              ))}
              {/* Bottom callout */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.75 }}
                className="relative overflow-hidden rounded-xl p-4"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.8), transparent)' }} />
                <p className="text-xs italic text-center leading-relaxed font-medium"
                  style={{ color: 'rgba(239,68,68,0.85)' }}>
                  No real-time intelligence.<br />No root cause. No predictions.
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Bottom statement */}
        <motion.div className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.9 }}>
          <div className="inline-block relative">
            <p className="text-2xl md:text-3xl font-bold">
              <span className="text-foreground-secondary">Data exists. </span>
              <span className="gradient-text-brand">Intelligence is missing.</span>
            </p>
            <motion.div className="absolute -bottom-3 left-0 right-0 h-px"
              initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ delay: 1.1, duration: 0.8 }}
              style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.6), rgba(6,182,212,0.6), transparent)' }} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   SOLUTION SECTION — Powerful redesign with animated feature cards
══════════════════════════════════════════════════════════════ */
function SolutionSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const features = [
    { icon: Link2, text: 'Connects structured data', desc: 'CRM, ERP, databases — unified in real-time', rgb: '59,130,246', textColor: 'hsl(217,91%,60%)' },
    { icon: FileText, text: 'Ingests unstructured docs', desc: 'PDFs, emails, reports — auto-processed instantly', rgb: '139,92,246', textColor: 'hsl(263,70%,58%)' },
    { icon: Brain, text: 'Domain AIX logic', desc: 'Industry-specific reasoning built deep into every model', rgb: '6,182,212', textColor: 'hsl(187,96%,42%)' },
    { icon: AlertTriangle, text: 'Risk detection', desc: 'Anomalies and threats surfaced before they escalate', rgb: '239,68,68', textColor: 'hsl(0,84%,60%)' },
    { icon: TrendingUp, text: 'Trend forecasting', desc: 'Future patterns distilled from your historical signals', rgb: '245,158,11', textColor: 'hsl(38,92%,50%)' },
    { icon: MessageSquare, text: 'Natural language explanations', desc: 'Ask in plain English. Get precise business answers.', rgb: '16,185,129', textColor: 'hsl(160,84%,39%)' },
  ];

  return (
    <section ref={ref} className="py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-background-elevated/40" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        {/* Pulsing central glow */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full blur-3xl"
          animate={{ opacity: [0.4, 0.75, 0.4] }} transition={{ duration: 5, repeat: Infinity }}
          style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.08) 45%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.018]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Heading */}
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 55 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.85 }}>
          <SectionLabel>OUR SOLUTION</SectionLabel>
          <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-5 leading-tight">
            Introducing the Business<br />
            <span className="gradient-text-ai">Intelligence Co-Pilot</span>
          </h2>
          <p className="text-foreground-secondary text-lg md:text-xl max-w-2xl mx-auto">
            A unified AI intelligence layer that <em>reasons</em> over your data — not just retrieves from it.
          </p>
        </motion.div>

        {/* Feature cards — 3-column animated grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {features.map(({ icon: Icon, text, desc, rgb, textColor }, i) => (
            <motion.div key={text}
              initial={{ opacity: 0, y: 45, scale: 0.93 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.55, type: 'spring', stiffness: 120 }}
              className="group relative overflow-hidden rounded-2xl p-6 hover-lift cursor-default"
              style={{
                background: `linear-gradient(135deg, rgba(${rgb},0.14) 0%, rgba(${rgb},0.04) 60%, transparent 100%)`,
                border: `1px solid rgba(${rgb},0.28)`,
                boxShadow: `0 4px 30px rgba(${rgb},0.1)`,
              }}>
              {/* Top gradient line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, transparent, rgba(${rgb},0.85), transparent)` }} />
              {/* Hover radial glow */}
              <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(ellipse at top left, rgba(${rgb},0.12) 0%, transparent 65%)` }} />
              {/* Ghost BG icon */}
              <div className="absolute -bottom-3 -right-3 w-28 h-28 opacity-[0.07] group-hover:opacity-[0.13] transition-opacity duration-500">
                <Icon className="w-full h-full" style={{ color: textColor }} strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                {/* Icon with entrance glow animation */}
                <motion.div
                  animate={inView ? { boxShadow: [`0 0 0px rgba(${rgb},0)`, `0 0 24px rgba(${rgb},0.55)`, `0 0 14px rgba(${rgb},0.3)`] } : {}}
                  transition={{ delay: 0.45 + i * 0.1, duration: 1.3 }}
                  className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `rgba(${rgb},0.18)`, border: `1px solid rgba(${rgb},0.35)` }}>
                  <Icon className="h-6 w-6" style={{ color: textColor }} />
                </motion.div>
                <h3 className="font-bold text-base mb-2" style={{ color: textColor }}>{text}</h3>
                <p className="text-sm text-foreground-secondary leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Cinematic quote block */}
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.97 }} animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ delay: 0.9, duration: 0.7 }}
          className="relative rounded-3xl p-10 md:p-14 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.16) 0%, rgba(59,130,246,0.11) 50%, rgba(6,182,212,0.07) 100%)',
            border: '1px solid rgba(139,92,246,0.38)',
            boxShadow: '0 0 120px rgba(139,92,246,0.18), 0 0 60px rgba(59,130,246,0.12), inset 0 1px 0 rgba(139,92,246,0.28)',
          }}>
          {/* Animated sweeping top border */}
          <motion.div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
            animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity }}
            style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.9) 30%, rgba(59,130,246,0.9) 60%, rgba(6,182,212,0.9) 80%, transparent 100%)' }} />
          {/* Corner glows */}
          <div className="absolute -top-16 -left-16 w-60 h-60 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(139,92,246,0.12)' }} />
          <div className="absolute -bottom-16 -right-16 w-60 h-60 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(59,130,246,0.1)' }} />
          <div className="relative z-10 text-center">
            <motion.div
              animate={inView ? { filter: ['drop-shadow(0 0 8px rgba(139,92,246,0.4))', 'drop-shadow(0 0 20px rgba(139,92,246,0.8))', 'drop-shadow(0 0 12px rgba(139,92,246,0.5))'] } : {}}
              transition={{ delay: 1.2, duration: 2, repeat: Infinity }}>
              <Brain className="h-11 w-11 mx-auto mb-6 text-accent" />
            </motion.div>
            <p className="text-xl md:text-2xl font-medium italic text-foreground leading-relaxed mb-2">
              "This is not a chatbot. This is not a dashboard.
            </p>
            <p className="text-2xl md:text-3xl font-bold gradient-text-ai leading-tight">
              This is a business reasoning engine."
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   INDUSTRIES SECTION — Moved up, colorful industry cards
══════════════════════════════════════════════════════════════ */
function IndustriesSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.08 });

  const industries = [
    { icon: Factory, name: 'FMCG', desc: 'Demand forecasting & inventory intelligence', live: true, tags: ['Demand', 'Inventory', 'Forecasting'], rgb: '59, 130, 246', textColor: 'hsl(217, 91%, 60%)' },
    { icon: GraduationCap, name: 'Education', desc: 'Student analytics & retention', live: true, tags: ['Analytics', 'Retention', 'Performance'], rgb: '139, 92, 246', textColor: 'hsl(263, 70%, 58%)' },
    { icon: Activity, name: 'Healthcare', desc: 'Patient risk & ops analysis', live: false, tags: ['Risk Analysis', 'Patient Ops', 'Monitoring'], rgb: '16, 185, 129', textColor: 'hsl(160, 84%, 39%)' },
    { icon: Building2, name: 'Real Estate', desc: 'Lead scoring & deal intelligence', live: false, tags: ['Lead Scoring', 'Deals', 'Market Intel'], rgb: '245, 158, 11', textColor: 'hsl(38, 92%, 50%)' },
    { icon: Truck, name: 'Logistics', desc: 'Delivery & efficiency insights', live: true, tags: ['Delivery', 'Efficiency', 'Routes'], rgb: '6, 182, 212', textColor: 'hsl(187, 96%, 42%)' },
    { icon: CreditCard, name: 'FinTech', desc: 'Credit risk & anomaly detection', live: false, tags: ['Credit Risk', 'Anomaly', 'Fraud Detection'], rgb: '239, 68, 68', textColor: 'hsl(0, 84%, 60%)' },
  ];

  return (
    <section ref={ref} id="industries" className="py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute inset-0 opacity-[0.018]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.04) 0%, rgba(139,92,246,0.03) 50%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 60 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.85 }}>
          <SectionLabel>INDUSTRIES</SectionLabel>
          <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-5 leading-tight">
            Built for <span className="gradient-text-brand">Every Industry</span>
          </h2>
          <p className="text-foreground-secondary text-lg md:text-xl max-w-xl mx-auto">
            Core platform stays the same. Domain intelligence adapts.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {industries.map(({ icon: Icon, name, desc, live, tags, rgb, textColor }, i) => (
            <motion.div key={name}
              initial={{ opacity: 0, y: 45, scale: 0.94 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: i * 0.1, duration: 0.55 }}
              className="relative overflow-hidden rounded-2xl group hover-lift"
              style={{
                background: `linear-gradient(135deg, rgba(${rgb},${live ? '0.18' : '0.10'}) 0%, rgba(${rgb},0.04) 55%, transparent 100%)`,
                border: `1px solid rgba(${rgb},${live ? '0.45' : '0.24'})`,
                boxShadow: live ? `0 0 55px rgba(${rgb},0.22), inset 0 1px 0 rgba(${rgb},0.22)` : 'none',
                opacity: live ? 1 : 0.72,
              }}>
              {live && (
                <motion.div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                  animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2.5 }}
                  style={{ background: `linear-gradient(90deg, transparent, rgba(${rgb},0.95), transparent)` }} />
              )}
              <div className="absolute -bottom-5 -right-5 w-40 h-40 transition-all duration-500 group-hover:scale-110" style={{ opacity: 0.065 }}>
                <Icon className="w-full h-full" style={{ color: textColor }} strokeWidth={0.7} />
              </div>
              <div className="relative z-10 p-6">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `rgba(${rgb},${live ? '0.18' : '0.10'})`,
                    border: `1px solid rgba(${rgb},${live ? '0.32' : '0.2'})`,
                    boxShadow: live ? `0 0 22px rgba(${rgb},0.22)` : 'none',
                  }}>
                  <Icon className="h-6 w-6" style={{ color: textColor }} />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-1">{name}</h3>
                <p className="text-sm text-foreground-secondary mb-3">{desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tags.map((tag) => (
                    <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{ color: textColor, background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.22)` }}>
                      {tag}
                    </span>
                  ))}
                </div>
                {live ? (
                  <div className="flex items-center justify-between">
                    <motion.span animate={{ opacity: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 1.8 }}
                      className="text-xs font-bold text-success bg-success/15 px-3 py-1.5 rounded-full border border-success/25 flex items-center gap-1.5">
                      <motion.span animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                      LIVE NOW
                    </motion.span>
                    <Link to="/signup" className="text-sm font-medium flex items-center gap-1 transition-all group-hover:gap-2"
                      style={{ color: textColor }}>
                      Start Free <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-foreground-secondary bg-muted/60 px-2.5 py-1.5 rounded-full flex items-center gap-1.5 w-fit border border-border/40">
                    <Lock className="h-3 w-3" /> Coming Soon
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   INTEGRATIONS SECTION — Brand logos + Hub connection visual
══════════════════════════════════════════════════════════════ */
function IntegrationsSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.08 });
  const ticker = 'HubSpot · Salesforce · Zoho CRM · Monday.com · Odoo · QuickBooks · Xero · Microsoft Dynamics · Slack · Gmail · Notion · ';

  const crmBrands = [
    { name: 'HubSpot',     logo: '/HubSpot.png',    hex: '#FF7A59', desc: 'Marketing & Sales CRM' },
    { name: 'Salesforce',  logo: '/SalesForce.png', hex: '#00A1E0', desc: 'Enterprise CRM leader' },
    { name: 'Zoho CRM',    logo: '/Zoho.png',       hex: '#E42527', desc: 'SMB-friendly CRM suite' },
    { name: 'Monday.com',  logo: '/Monday.png',     hex: '#FF3D57', desc: 'Work OS & CRM platform' },
  ];

  const erpBrands = [
    { name: 'Odoo',        logo: '/Odoo.png',       hex: '#875A7B', desc: 'Open-source ERP suite' },
    { name: 'QuickBooks',  logo: '/QuickBook.png',  hex: '#2CA01C', desc: 'SMB accounting standard' },
    { name: 'Xero',        logo: '/Xero.png',       hex: '#13B5EA', desc: 'Cloud accounting platform' },
  ];

  return (
    <section ref={ref} id="integrations" className="py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[800px] rounded-full blur-3xl"
          animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 6, repeat: Infinity }}
          style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.06) 50%, transparent 70%)' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Heading */}
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 55 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.85 }}>
          <SectionLabel>INTEGRATIONS</SectionLabel>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-5 leading-tight">
            Seamless Enterprise <span className="gradient-text-brand">Integration</span>
          </h2>
          <p className="text-foreground-secondary text-lg md:text-xl max-w-2xl mx-auto">
            Your data remains yours. We simply make it intelligent.
          </p>
        </motion.div>

        {/* ── Connection Layout: CRM | Hub | ERP ── */}
        <div className="grid lg:grid-cols-[1fr_180px_1fr] gap-6 items-center mb-10">

          {/* CRM Panel */}
          <motion.div initial={{ opacity: 0, x: -70 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative overflow-hidden rounded-2xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.14) 0%, rgba(59,130,246,0.04) 60%, transparent 100%)',
              border: '1px solid rgba(59,130,246,0.32)',
              boxShadow: '0 0 70px rgba(59,130,246,0.12), inset 0 1px 0 rgba(59,130,246,0.2)',
            }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.9), transparent)' }} />
            {/* Section header */}
            <div className="flex items-center gap-3 mb-5 pb-4"
              style={{ borderBottom: '1px solid rgba(59,130,246,0.15)' }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.32)', boxShadow: '0 0 18px rgba(59,130,246,0.28)' }}>
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-primary text-base">CRM Platforms</h3>
                <p className="text-xs text-foreground-secondary">Customer relationship systems</p>
              </div>
            </div>
            {/* Brand rows */}
            <div className="space-y-2.5">
              {crmBrands.map(({ name, logo, hex, desc }, i) => (
                <motion.div key={name}
                  initial={{ opacity: 0, x: -35 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.35 + i * 0.09, duration: 0.48 }}
                  className="group flex items-center gap-3 rounded-xl p-3 cursor-default transition-all duration-300 hover-lift"
                  style={{ background: `${hex}18`, border: `1px solid ${hex}38` }}>
                  {/* Brand logo */}
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white"
                    style={{ boxShadow: `0 0 16px ${hex}55`, padding: '5px' }}>
                    <img src={logo} alt={name} className="h-full w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground leading-tight">{name}</p>
                    <p className="text-xs text-foreground-secondary truncate">{desc}</p>
                  </div>
                  {/* Live pulse dot */}
                  <motion.div className="h-2 w-2 rounded-full flex-shrink-0"
                    animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.4, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.4 }}
                    style={{ background: hex }} />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── Center Hub ── */}
          <div className="hidden lg:flex flex-col items-center justify-center">
            {/* CRM → Hub line */}
            <motion.div className="flex items-center w-full mb-1" style={{ height: 2 }}>
              <motion.div className="flex-1 h-px"
                initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ delay: 0.65, duration: 0.7 }}
                style={{ background: 'linear-gradient(to right, rgba(59,130,246,0.6), rgba(59,130,246,0.2))', transformOrigin: 'right' }} />
              <motion.div className="h-1.5 w-1.5 rounded-full mx-1 flex-shrink-0"
                animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ background: 'rgba(59,130,246,0.7)' }} />
              <motion.div className="flex-1 h-px"
                initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ delay: 0.65, duration: 0.7 }}
                style={{ background: 'linear-gradient(to left, rgba(139,92,246,0.6), rgba(139,92,246,0.2))', transformOrigin: 'left' }} />
            </motion.div>

            {/* Hub orb */}
            <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.75, type: 'spring', stiffness: 150 }}
              className="relative flex items-center justify-center my-3"
              style={{ width: 140, height: 140 }}>
              {/* Rings */}
              {[0.6, 0.35].map((opacity, idx) => (
                <motion.div key={idx} className="absolute rounded-full"
                  animate={{ scale: [1, 1.55 + idx * 0.4, 1], opacity: [opacity, 0, opacity] }}
                  transition={{ duration: 3.5, repeat: Infinity, delay: idx * 0.9 }}
                  style={{ width: 80, height: 80, background: `rgba(59,130,246,${opacity * 0.5})` }} />
              ))}
              {/* Orbit ring */}
              <motion.div className="absolute rounded-full"
                animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                style={{ width: 108, height: 108, border: '1px dashed rgba(59,130,246,0.38)' }} />
              <motion.div className="absolute rounded-full"
                animate={{ rotate: -360 }} transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
                style={{ width: 128, height: 128, border: '1px dashed rgba(139,92,246,0.22)' }} />
              {/* Core */}
              <div className="relative z-10 h-16 w-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.2))',
                  border: '1px solid rgba(59,130,246,0.5)',
                  boxShadow: '0 0 50px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                }}>
                <Cpu className="h-7 w-7 text-primary" style={{ filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.9))' }} />
              </div>
            </motion.div>
            {/* Label */}
            <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 1 }}
              className="text-center mb-1">
              <p className="text-xs font-bold gradient-text-brand">PulseIQ Hub</p>
              <p className="text-[10px] text-foreground-secondary mt-0.5">Intelligence Layer</p>
            </motion.div>
            {/* Bottom line */}
            <motion.div className="flex items-center w-full mt-1" style={{ height: 2 }}>
              <motion.div className="flex-1 h-px"
                initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ delay: 0.65, duration: 0.7 }}
                style={{ background: 'linear-gradient(to right, rgba(59,130,246,0.3), rgba(59,130,246,0.1))', transformOrigin: 'right' }} />
              <motion.div className="h-1.5 w-1.5 rounded-full mx-1 flex-shrink-0"
                animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                style={{ background: 'rgba(139,92,246,0.7)' }} />
              <motion.div className="flex-1 h-px"
                initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ delay: 0.65, duration: 0.7 }}
                style={{ background: 'linear-gradient(to left, rgba(139,92,246,0.3), rgba(139,92,246,0.1))', transformOrigin: 'left' }} />
            </motion.div>
          </div>

          {/* ERP Panel */}
          <motion.div initial={{ opacity: 0, x: 70 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(139,92,246,0.04) 60%, transparent 100%)',
              border: '1px solid rgba(139,92,246,0.32)',
              boxShadow: '0 0 70px rgba(139,92,246,0.12), inset 0 1px 0 rgba(139,92,246,0.2)',
            }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.9), transparent)' }} />
            {/* Section header */}
            <div className="flex items-center gap-3 mb-5 pb-4"
              style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.32)', boxShadow: '0 0 18px rgba(139,92,246,0.28)' }}>
                <Database className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-accent text-base">ERP / Accounting</h3>
                <p className="text-xs text-foreground-secondary">Enterprise resource planning</p>
              </div>
            </div>
            {/* Brand rows */}
            <div className="space-y-2.5">
              {erpBrands.map(({ name, logo, hex, desc }, i) => (
                <motion.div key={name}
                  initial={{ opacity: 0, x: 35 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.45 + i * 0.09, duration: 0.48 }}
                  className="group flex items-center gap-3 rounded-xl p-3 cursor-default transition-all duration-300 hover-lift"
                  style={{ background: `${hex}18`, border: `1px solid ${hex}38` }}>
                  {/* Brand logo */}
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white"
                    style={{ boxShadow: `0 0 16px ${hex}55`, padding: '5px' }}>
                    <img src={logo} alt={name} className="h-full w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground leading-tight">{name}</p>
                    <p className="text-xs text-foreground-secondary truncate">{desc}</p>
                  </div>
                  <motion.div className="h-2 w-2 rounded-full flex-shrink-0"
                    animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.4, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.35 }}
                    style={{ background: hex }} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Bottom row: Unstructured + Stats ── */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Unstructured data */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.65, duration: 0.65 }}
            className="relative overflow-hidden rounded-2xl p-6 group"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(139,92,246,0.04) 55%, transparent 100%)',
              border: '1px solid rgba(139,92,246,0.28)',
              boxShadow: '0 0 50px rgba(139,92,246,0.08)',
            }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.85), transparent)' }} />
            <div className="absolute -bottom-4 -right-4 w-36 h-36 opacity-[0.07] group-hover:opacity-[0.13] transition-opacity duration-500">
              <FileText className="w-full h-full text-accent" strokeWidth={0.7} />
            </div>
            <div className="relative z-10">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.32)', boxShadow: '0 0 18px rgba(139,92,246,0.22)' }}>
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-bold text-accent text-base mb-2">Unstructured Data</h3>
              <p className="text-foreground-secondary text-sm mb-4 leading-relaxed">
                Extract intelligence from documents, contracts, emails and reports automatically. No formatting required.
              </p>
              <div className="flex flex-wrap gap-2">
                {['PDFs', 'Contracts', 'Excel', 'Transcripts', 'Email', 'Reports'].map((s) => (
                  <span key={s} className="px-2.5 py-1 text-accent text-xs rounded-full font-medium"
                    style={{ background: 'rgba(139,92,246,0.13)', border: '1px solid rgba(139,92,246,0.28)' }}>{s}</span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Stats hub card */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.75, duration: 0.65 }}
            className="relative rounded-2xl p-6 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.08))',
              border: '1px solid rgba(59,130,246,0.24)',
              boxShadow: '0 0 60px rgba(59,130,246,0.1)',
            }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7), rgba(139,92,246,0.7), transparent)' }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full h-8 w-px"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.45))' }} />
            <div className="relative z-10 text-center">
              <Cpu className="h-8 w-8 mx-auto mb-3 text-primary" style={{ filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.7))' }} />
              <p className="font-bold text-foreground text-base mb-1">PulseIQ Intelligence Hub</p>
              <p className="text-foreground-secondary text-sm mb-5">All your data sources unified into one reasoning engine</p>
              <div className="grid grid-cols-3 gap-3">
                {[['10+', 'Data Sources'], ['Real-time', 'Processing'], ['100%', 'Secure']].map(([val, label]) => (
                  <div key={label} className="text-center">
                    <div className="text-lg font-bold gradient-text-brand">{val}</div>
                    <div className="text-xs text-foreground-secondary mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Ticker */}
        <div className="overflow-hidden py-4 border-t border-border/30">
          <div className="animate-ticker whitespace-nowrap text-foreground-secondary/40 text-sm font-medium">{ticker}{ticker}</div>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   CAPABILITIES SECTION — 4 cards with coloured gradient BGs
══════════════════════════════════════════════════════════════ */
function CapabilitiesSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.15 });

  const caps = [
    { icon: AlertTriangle, title: 'Detect Risks', desc: 'Churn, stockouts, delays, revenue drops', rgb: '239, 68, 68', textColor: 'hsl(0, 84%, 60%)' },
    { icon: TrendingUp, title: 'Forecast Trends', desc: 'Demand, revenue, performance, resources', rgb: '59, 130, 246', textColor: 'hsl(217, 91%, 60%)' },
    { icon: Brain, title: 'Root Cause Analysis', desc: 'Performance declines, profitability, inefficiencies', rgb: '245, 158, 11', textColor: 'hsl(38, 92%, 50%)' },
    { icon: Check, title: 'Actionable Recommendations', desc: 'Next steps, priorities, optimizations', rgb: '16, 185, 129', textColor: 'hsl(160, 84%, 39%)' },
  ];

  return (
    <section ref={ref} id="capabilities" className="py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-background-elevated/40" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div className="text-center mb-14"
          initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
          <SectionLabel>CAPABILITIES</SectionLabel>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            From Raw Data to <span className="gradient-text-brand">Executive Decisions</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {caps.map(({ icon: Icon, title, desc, rgb, textColor }, i) => (
            <motion.div key={title}
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              className="relative overflow-hidden rounded-2xl p-7 group hover-lift"
              style={{
                background: `linear-gradient(135deg, rgba(${rgb},0.13) 0%, rgba(${rgb},0.03) 55%, transparent 100%)`,
                border: `1px solid rgba(${rgb},0.28)`,
                boxShadow: `0 0 40px rgba(${rgb},0.08)`,
              }}>
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, transparent, rgba(${rgb},0.8), transparent)` }} />
              <div className="absolute -bottom-4 -right-4 w-32 h-32 opacity-[0.07] transition-opacity duration-500 group-hover:opacity-[0.13]">
                <Icon className="w-full h-full" style={{ color: textColor }} strokeWidth={0.7} />
              </div>
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.28)`, boxShadow: `0 0 20px rgba(${rgb},0.18)` }}>
                  <Icon className="h-6 w-6" style={{ color: textColor }} />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-foreground-secondary leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p className="mt-12 text-lg italic text-foreground-secondary text-center"
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.6 }}>
          "This is AI that reasons — <span className="gradient-text-brand font-semibold">not just summarizes.</span>"
        </motion.p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROCESS SECTION — Steps with arrow connectors
══════════════════════════════════════════════════════════════ */
function ProcessSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.15 });

  const steps = [
    { num: '01', title: 'Data Integration Layer', desc: 'Connects structured + unstructured sources. CSV/Excel today. ERP/CRM connectors coming soon.', rgb: '59, 130, 246', textColor: 'hsl(217, 91%, 60%)' },
    { num: '02', title: 'AIX Intelligence Layer', desc: 'Domain-specific logic, risk scoring, pattern detection, deterministic decision models.', rgb: '139, 92, 246', textColor: 'hsl(263, 70%, 58%)' },
    { num: '03', title: 'AI Explanation Layer', desc: 'LLaMA3 via Groq explains insights, surfaces recommendations, answers in plain language.', rgb: '6, 182, 212', textColor: 'hsl(187, 96%, 42%)' },
  ];

  return (
    <section ref={ref} id="process" className="py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
          <SectionLabel>PROCESS</SectionLabel>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Three Layers of <span className="gradient-text-brand">Intelligence</span>
          </h2>
        </motion.div>

        <div className="flex flex-col md:flex-row items-stretch gap-4">
          {steps.map(({ num, title, desc, rgb, textColor }, i) => (
            <div key={num} className="flex flex-row md:flex-col items-center flex-1 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                className="relative overflow-hidden rounded-2xl p-7 flex-1 group hover-lift w-full"
                style={{
                  background: `linear-gradient(135deg, rgba(${rgb},0.14) 0%, rgba(${rgb},0.03) 55%, transparent 100%)`,
                  border: `1px solid rgba(${rgb},0.3)`,
                }}>
                <div className="absolute top-3 right-3 text-7xl font-black leading-none select-none"
                  style={{ color: `rgba(${rgb},0.08)` }}>{num}</div>
                <div className="h-1 w-14 rounded-full mb-5"
                  style={{ background: `linear-gradient(90deg, rgba(${rgb},0.9), rgba(${rgb},0.25))` }} />
                <div className="h-11 w-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.28)` }}>
                  <span className="text-sm font-bold" style={{ color: textColor }}>{num}</span>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-foreground-secondary leading-relaxed">{desc}</p>
              </motion.div>

              {i < 2 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.5 + i * 0.2 }}
                  className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center md:rotate-0 rotate-90"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
                    border: '1px solid rgba(59,130,246,0.28)',
                  }}>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </motion.div>
              )}
            </div>
          ))}
        </div>

        <motion.div className="mt-10 flex justify-center"
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.7 }}>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-success/10 text-success text-sm font-medium border border-success/20">
            <Check className="h-4 w-4" /> Explainable, enterprise-ready intelligence.
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   SECURITY SECTION — Animated Shield + colorful badge cards
══════════════════════════════════════════════════════════════ */
function SecuritySection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const badges = [
    { icon: Zap, text: 'Cloud/On-Premise', desc: 'Deploy anywhere — cloud, hybrid, or on-prem', rgb: '59,130,246', textColor: 'hsl(217,91%,60%)' },
    { icon: Users, text: 'RBAC', desc: 'Granular role-based access control built in', rgb: '139,92,246', textColor: 'hsl(263,70%,58%)' },
    { icon: Lock, text: 'Encryption', desc: 'AES-256 end-to-end data protection at rest & transit', rgb: '16,185,129', textColor: 'hsl(160,84%,39%)' },
    { icon: ClipboardList, text: 'Audit Logging', desc: 'Full immutable activity trail for compliance', rgb: '6,182,212', textColor: 'hsl(187,96%,42%)' },
    { icon: ServerOff, text: 'No data sharing', desc: 'Your data never leaves your environment', rgb: '245,158,11', textColor: 'hsl(38,92%,50%)' },
    { icon: Shield, text: 'High Availability', desc: '99.9% uptime SLA with redundant infrastructure', rgb: '239,68,68', textColor: 'hsl(0,84%,60%)' },
  ];

  return (
    <section ref={ref} className="py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-background-elevated/40" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        {/* Pulsing deep glow */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full blur-3xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 6, repeat: Infinity }}
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(16,185,129,0.06) 45%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.018]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Heading with animated shield */}
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 55 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.85 }}>
          {/* Animated shield orb */}
          <div className="flex justify-center mb-9">
            <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
              {/* Expanding pulse rings */}
              {[1, 1.8, 2.7].map((scale, idx) => (
                <motion.div key={idx} className="absolute rounded-full"
                  animate={inView ? { scale: [1, scale, 1], opacity: [0.45 - idx * 0.12, 0, 0.45 - idx * 0.12] } : {}}
                  transition={{ duration: 3.2, repeat: Infinity, delay: idx * 0.65 }}
                  style={{ width: 80, height: 80, background: `rgba(59,130,246,${0.18 - idx * 0.05})` }} />
              ))}
              {/* Rotating dashed ring */}
              <motion.div className="absolute rounded-full"
                animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                style={{ width: 94, height: 94, border: '1px dashed rgba(59,130,246,0.4)', borderRadius: '50%' }} />
              {/* Counter-rotating outer ring */}
              <motion.div className="absolute rounded-full"
                animate={{ rotate: -360 }} transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                style={{ width: 112, height: 112, border: '1px dashed rgba(16,185,129,0.25)', borderRadius: '50%' }} />
              {/* Shield icon */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }} animate={inView ? { scale: 1, opacity: 1 } : {}}
                transition={{ delay: 0.35, type: 'spring', stiffness: 180 }}
                className="relative z-10 h-16 w-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(16,185,129,0.18))',
                  border: '1px solid rgba(59,130,246,0.5)',
                  boxShadow: '0 0 50px rgba(59,130,246,0.35), inset 0 1px 0 rgba(59,130,246,0.45)',
                }}>
                <Shield className="h-8 w-8 text-primary" style={{ filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.9))' }} />
              </motion.div>
            </div>
          </div>
          <SectionLabel>ENTERPRISE-READY</SectionLabel>
          <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-4 leading-tight">
            Secure. <span className="gradient-text-brand">Governed.</span> Scalable.
          </h2>
          <p className="text-foreground-secondary text-lg max-w-xl mx-auto">
            Built from the ground up for enterprises that take data responsibility seriously.
          </p>
        </motion.div>

        {/* Badge cards — colorful 3×2 grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {badges.map(({ icon: Icon, text, desc, rgb, textColor }, i) => (
            <motion.div key={text}
              initial={{ opacity: 0, y: 40, scale: 0.92 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.55, type: 'spring', stiffness: 130 }}
              className="group relative overflow-hidden rounded-2xl p-6 hover-lift cursor-default"
              style={{
                background: `linear-gradient(135deg, rgba(${rgb},0.13) 0%, rgba(${rgb},0.04) 60%, transparent 100%)`,
                border: `1px solid rgba(${rgb},0.26)`,
                boxShadow: `0 4px 28px rgba(${rgb},0.09)`,
              }}>
              {/* Top gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, transparent, rgba(${rgb},0.8), transparent)` }} />
              {/* Hover radial */}
              <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(ellipse at top, rgba(${rgb},0.11) 0%, transparent 70%)` }} />
              {/* Ghost BG icon */}
              <div className="absolute -bottom-2 -right-2 w-24 h-24 opacity-[0.07] group-hover:opacity-[0.13] transition-opacity duration-500">
                <Icon className="w-full h-full" style={{ color: textColor }} strokeWidth={0.8} />
              </div>
              <div className="relative z-10">
                <motion.div
                  whileHover={{ scale: 1.12 }} transition={{ type: 'spring', stiffness: 300 }}
                  animate={inView ? { boxShadow: [`0 0 0px rgba(${rgb},0)`, `0 0 20px rgba(${rgb},0.5)`, `0 0 10px rgba(${rgb},0.25)`] } : {}}
                  style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, background: `rgba(${rgb},0.18)`, border: `1px solid rgba(${rgb},0.32)` }}>
                  <Icon className="h-6 w-6" style={{ color: textColor }} />
                </motion.div>
                <h3 className="font-bold text-base mb-1.5" style={{ color: textColor }}>{text}</h3>
                <p className="text-sm text-foreground-secondary leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust metrics bar */}
        <motion.div
          initial={{ opacity: 0, y: 25 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1.1, duration: 0.65 }}
          className="mt-14 relative rounded-2xl p-7 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(16,185,129,0.08))',
            border: '1px solid rgba(59,130,246,0.26)',
            boxShadow: '0 0 70px rgba(59,130,246,0.1)',
          }}>
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.75), rgba(16,185,129,0.75), transparent)' }} />
          <div className="flex flex-wrap justify-center gap-10 md:gap-16">
            {[['SOC 2', 'Type II Ready'], ['AES-256', 'Encryption'], ['99.9%', 'Uptime SLA'], ['Zero', 'Data Leakage']].map(([val, label], i) => (
              <motion.div key={label} className="text-center"
                initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 1.2 + i * 0.1 }}>
                <div className="text-2xl font-bold gradient-text-brand">{val}</div>
                <div className="text-xs text-foreground-secondary mt-1 font-medium">{label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   DIFFERENTIATION SECTION — Highlighted comparison table
══════════════════════════════════════════════════════════════ */
function DifferentiationSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.15 });

  const rows = [
    'Works on internal business data',
    'Structured intelligence logic (AIX)',
    'Explainable decisions',
    'Cross-system integration',
    'Long-term intelligence layer',
    'Industry-specific domain models',
  ];

  return (
    <section ref={ref} className="py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div className="text-center mb-14"
          initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
          <SectionLabel>DIFFERENTIATION</SectionLabel>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Not Just AI. <span className="gradient-text-brand">Not Just Analytics.</span>
          </h2>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2, duration: 0.6 }}
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(59,130,246,0.22)', boxShadow: '0 0 60px rgba(59,130,246,0.07)' }}>
          <div className="grid grid-cols-3">
            <div className="p-4 text-left text-sm font-semibold text-foreground-secondary bg-background-elevated/60">Feature</div>
            <div className="p-4 text-center text-sm font-semibold text-foreground-secondary bg-background-elevated/60">Generic AI</div>
            <div className="p-4 text-center text-sm font-bold bg-primary/10 border-l border-primary/20 text-primary">PulseIQ</div>
          </div>
          {rows.map((row, i) => (
            <motion.div key={row}
              initial={{ opacity: 0, x: -15 }} animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="grid grid-cols-3 border-t border-border/50">
              <div className="p-4 text-left text-sm text-foreground bg-background-surface/20">{row}</div>
              <div className="p-4 flex justify-center items-center">
                <X className="h-5 w-5 text-destructive/50" />
              </div>
              <div className="p-4 flex justify-center items-center bg-primary/5 border-l border-primary/10">
                <Check className="h-5 w-5 text-success" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-14 space-y-2 text-center">
          {['This is not a dashboard.', 'This is not a chatbot.', 'This is your strategic business co-pilot.'].map((line, i) => (
            <motion.p key={i}
              initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 1 + i * 0.4 }}
              className={`text-lg ${i === 2 ? 'font-bold gradient-text-brand text-xl mt-4' : 'text-foreground-secondary italic'}`}>
              {line}
            </motion.p>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   VISION SECTION — Dramatic quote + enhanced stat cards
══════════════════════════════════════════════════════════════ */
function VisionSection() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.15 });

  return (
    <section ref={ref} id="vision" className="py-32 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-background-elevated/40" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.05) 0%, rgba(139,92,246,0.04) 50%, transparent 70%)' }} />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div className="text-center mb-14"
          initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
          <SectionLabel>THE VISION</SectionLabel>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            The Future of <span className="gradient-text-brand">Business Decisions</span>
          </h2>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.25, duration: 0.65 }}
          className="relative rounded-2xl p-10 mb-16 max-w-4xl mx-auto"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.09) 0%, rgba(139,92,246,0.06) 100%)',
            border: '1px solid rgba(59,130,246,0.22)',
            boxShadow: '0 0 70px rgba(59,130,246,0.08), inset 0 1px 0 rgba(59,130,246,0.18)',
          }}>
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.7), rgba(139,92,246,0.7), transparent)' }} />
          {/* Decorative quote marks */}
          <div className="absolute top-2 left-5 text-8xl font-serif leading-none select-none opacity-10 text-primary">"</div>
          <div className="absolute bottom-2 right-5 text-8xl font-serif leading-none select-none opacity-10 text-primary" style={{ transform: 'rotate(180deg)' }}>"</div>
          <p className="text-lg md:text-xl text-foreground leading-relaxed italic text-center relative z-10 px-6">
            "In the next decade, companies will not rely on static dashboards. They will rely on systems that understand operations, predict risks, identify opportunities, and guide leaders in real time. We are building that system."
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { value: 6, suffix: '+', label: 'Industries' },
            { value: 10, suffix: '+', label: 'Data Sources' },
            { value: 100, suffix: '%', label: 'Real-Time Insights' },
            { value: 99.9, suffix: '%', label: 'Enterprise Security', decimals: 1 },
          ].map(({ value, suffix, label, decimals }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="relative rounded-xl p-5 text-center hover-lift"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, transparent 100%)', border: '1px solid rgba(59,130,246,0.16)' }}>
              <StatCounter value={value} suffix={suffix} label={label} decimals={decimals} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   CTA SECTION — Gradient call to action
══════════════════════════════════════════════════════════════ */
function CTASection() {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-brand opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">Be Part of the Intelligence Revolution</h2>
        <p className="text-lg text-primary-foreground/80 mb-10">We are expanding with selected partners and investors.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/signup" className="bg-background text-foreground px-8 py-3.5 rounded-xl text-base font-semibold hover-lift">Request Demo</Link>
          <a href="#" className="border border-primary-foreground/30 text-primary-foreground px-8 py-3.5 rounded-xl text-base font-medium hover-lift">Partner With Us</a>
          <a href="#" className="border border-accent-foreground/30 text-primary-foreground px-8 py-3.5 rounded-xl text-base font-medium hover-lift">Invest With Us</a>
        </div>
      </div>
    </section>
  );
}

export default LandingSections;
