import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  ArrowRight, Shield, Brain,
  Factory, Activity, Truck, GraduationCap, CreditCard, Building2,
  Database, FileText, Cpu, Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const HeroSection = () => {

  /* ── Cycling industry word ── */
  const cycleIndustries = [
    { word: 'FMCG',        color: 'hsl(217,91%,65%)',   shadow: 'rgba(59,130,246,0.55)' },
    { word: 'Healthcare',  color: 'hsl(160,84%,46%)',   shadow: 'rgba(16,185,129,0.55)' },
    { word: 'Logistics',   color: 'hsl(187,96%,50%)',   shadow: 'rgba(6,182,212,0.55)'  },
    { word: 'Education',   color: 'hsl(263,70%,68%)',   shadow: 'rgba(139,92,246,0.55)' },
    { word: 'FinTech',     color: 'hsl(0,84%,65%)',     shadow: 'rgba(239,68,68,0.55)'  },
    { word: 'Real Estate', color: 'hsl(38,92%,56%)',    shadow: 'rgba(245,158,11,0.55)' },
  ];
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setWordIdx(p => (p + 1) % cycleIndustries.length), 2400);
    return () => clearInterval(t);
  }, []);

  /* ── Industry pills ── */
  const industryPills = [
    { icon: Factory,      label: 'FMCG',        rgb: '59,130,246'  },
    { icon: Activity,     label: 'Healthcare',   rgb: '16,185,129'  },
    { icon: Truck,        label: 'Logistics',    rgb: '6,182,212'   },
    { icon: GraduationCap,label: 'Education',    rgb: '139,92,246'  },
    { icon: CreditCard,   label: 'FinTech',      rgb: '239,68,68'   },
    { icon: Building2,    label: 'Real Estate',  rgb: '245,158,11'  },
  ];

  /* ── Data flow steps ── */
  const flowSteps = [
    { label: 'CRM',        icon: Database,  color: 'rgba(59,130,246,1)'  },
    { label: 'ERP',        icon: Cpu,       color: 'rgba(6,182,212,1)'   },
    { label: 'Documents',  icon: FileText,  color: 'rgba(139,92,246,1)'  },
    { label: 'PulseIQ AI', icon: Brain,     color: 'rgba(16,185,129,1)',  isPulse: true },
    { label: 'Insights',   icon: Zap,       color: 'rgba(245,158,11,1)'  },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">

      {/* ══════════════════════════════════════════
          WATER LIQUID BLOBS — unchanged
      ══════════════════════════════════════════ */}
      <div className="absolute inset-0 overflow-hidden">

        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Blob 1 — XL Blue, top-left */}
        <motion.div className="absolute pointer-events-none"
          style={{
            width: 520, height: 520, top: '2%', left: '-4%',
            background: 'radial-gradient(circle at 40% 40%, rgba(59,130,246,0.45) 0%, rgba(59,130,246,0.15) 60%, transparent 80%)',
            filter: 'blur(60px)',
          }}
          animate={{
            borderRadius: ['62% 38% 46% 54% / 60% 44% 56% 40%','38% 62% 54% 46% / 44% 60% 40% 56%','54% 46% 38% 62% / 56% 40% 60% 44%','62% 38% 46% 54% / 60% 44% 56% 40%'],
            x: [-10, 18, -5, -10], y: [-20, 30, -10, -20], scale: [1, 1.08, 0.96, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />

        {/* Blob 2 — XL Purple, bottom-right */}
        <motion.div className="absolute pointer-events-none"
          style={{
            width: 480, height: 480, bottom: '0%', right: '-4%',
            background: 'radial-gradient(circle at 55% 55%, rgba(139,92,246,0.42) 0%, rgba(139,92,246,0.14) 60%, transparent 80%)',
            filter: 'blur(65px)',
          }}
          animate={{
            borderRadius: ['40% 60% 55% 45% / 55% 45% 60% 40%','60% 40% 45% 55% / 40% 60% 45% 55%','45% 55% 60% 40% / 60% 40% 55% 45%','40% 60% 55% 45% / 55% 45% 60% 40%'],
            x: [12, -15, 8, 12], y: [25, -30, 15, 25], scale: [1, 0.94, 1.06, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />

        {/* Blob 3 — Cyan, top-right */}
        <motion.div className="absolute pointer-events-none"
          style={{
            width: 340, height: 340, top: '8%', right: '8%',
            background: 'radial-gradient(circle at 45% 45%, rgba(6,182,212,0.38) 0%, rgba(6,182,212,0.12) 60%, transparent 80%)',
            filter: 'blur(55px)',
          }}
          animate={{
            borderRadius: ['55% 45% 60% 40% / 40% 58% 42% 60%','45% 55% 40% 60% / 60% 40% 58% 42%','60% 40% 55% 45% / 42% 58% 40% 60%','55% 45% 60% 40% / 40% 58% 42% 60%'],
            x: [-12, 16, -6, -12], y: [-22, 18, -12, -22], scale: [1, 1.1, 0.92, 1],
          }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }} />

        {/* Blob 4 — Amber, bottom-left */}
        <motion.div className="absolute pointer-events-none"
          style={{
            width: 280, height: 280, bottom: '15%', left: '4%',
            background: 'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.30) 0%, rgba(245,158,11,0.10) 60%, transparent 80%)',
            filter: 'blur(50px)',
          }}
          animate={{
            borderRadius: ['48% 52% 42% 58% / 52% 48% 58% 42%','58% 42% 52% 48% / 42% 58% 48% 52%','42% 58% 48% 52% / 58% 42% 52% 48%','48% 52% 42% 58% / 52% 48% 58% 42%'],
            x: [10, -14, 6, 10], y: [18, -22, 10, 18], scale: [1, 1.05, 0.97, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3.5 }} />

        {/* Blob 5 — Teal, mid-left */}
        <motion.div className="absolute pointer-events-none"
          style={{
            width: 200, height: 200, top: '42%', left: '2%',
            background: 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0.08) 60%, transparent 80%)',
            filter: 'blur(45px)',
          }}
          animate={{
            borderRadius: ['52% 48% 44% 56% / 44% 56% 48% 52%','44% 56% 52% 48% / 56% 44% 52% 48%','56% 44% 48% 52% / 48% 52% 44% 56%','52% 48% 44% 56% / 44% 56% 48% 52%'],
            y: [-16, 20, -8, -16], scale: [1, 1.12, 0.9, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }} />

        {/* Blob 6 — Indigo, mid-right */}
        <motion.div className="absolute pointer-events-none"
          style={{
            width: 170, height: 170, top: '50%', right: '4%',
            background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.08) 60%, transparent 80%)',
            filter: 'blur(40px)',
          }}
          animate={{
            borderRadius: ['46% 54% 58% 42% / 58% 42% 54% 46%','58% 42% 46% 54% / 42% 58% 46% 54%','54% 46% 42% 58% / 54% 46% 58% 42%','46% 54% 58% 42% / 58% 42% 54% 46%'],
            y: [14, -18, 8, 14], scale: [1, 0.92, 1.08, 1],
          }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 4 }} />

        {/* Centre deep glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: 800, height: 800, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.05) 40%, transparent 70%)',
            filter: 'blur(50px)',
          }} />
      </div>

      {/* ══════════════════════════════════════════
          HERO CONTENT
      ══════════════════════════════════════════ */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">

        {/* ── Data flow strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
          className="flex items-center justify-center flex-wrap gap-1.5 mb-8">
          {flowSteps.map(({ label, icon: Icon, color, isPulse }, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <motion.div
                initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.38 + i * 0.12, duration: 0.4, type: 'spring', stiffness: 150 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: isPulse
                    ? color.replace('1)', '0.18)')
                    : color.replace('1)', '0.09)'),
                  border: `1px solid ${color.replace('1)', '0.32)')}`,
                  color,
                  boxShadow: isPulse ? `0 0 22px ${color.replace('1)', '0.35)')}` : 'none',
                }}>
                {isPulse && (
                  <motion.div
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    animate={{ scale: [1, 1.6, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                    style={{ background: color }} />
                )}
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{label}</span>
              </motion.div>

              {/* Arrow connector with flowing dot */}
              {i < flowSteps.length - 1 && (
                <motion.div
                  className="relative flex items-center"
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.12, duration: 0.35, transformOrigin: 'left' }}
                  style={{ width: 22 }}>
                  <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full"
                    animate={{ x: [0, 22, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.45 }}
                    style={{ background: 'rgba(59,130,246,0.8)', left: 0 }} />
                </motion.div>
              )}
            </div>
          ))}
        </motion.div>

        {/* ── Main heading with cycling industry word ── */}
        <motion.h1
          initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42, duration: 0.6 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
          Turn Your{' '}
          {/* Cycling word wrapper — fixed height prevents layout jump */}
          <span className="inline-block relative" style={{ verticalAlign: 'bottom' }}>
            <AnimatePresence mode="wait">
              <motion.span
                key={wordIdx}
                initial={{ y: 36, opacity: 0, filter: 'blur(4px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: -36, opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: 'easeOut' }}
                className="inline-block"
                style={{
                  color: cycleIndustries[wordIdx].color,
                  filter: `drop-shadow(0 0 24px ${cycleIndustries[wordIdx].shadow})`,
                }}>
                {cycleIndustries[wordIdx].word}
              </motion.span>
            </AnimatePresence>
          </span>
          {' '}Data<br />
          <span className="gradient-text-brand">Into Strategic Intelligence</span>
        </motion.h1>

        {/* ── Industry pills — 6 industries shown immediately ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.55 }}
          className="flex flex-wrap justify-center gap-2 mb-8">
          {industryPills.map(({ icon: Icon, label, rgb }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.07, duration: 0.35, type: 'spring', stiffness: 180 }}>
              <motion.div
                animate={{ y: [0, -3.5, 0] }}
                transition={{ duration: 2.8 + i * 0.25, repeat: Infinity, ease: 'easeInOut', delay: i * 0.18 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-default"
                style={{
                  background: `rgba(${rgb},0.1)`,
                  border: `1px solid rgba(${rgb},0.28)`,
                  color: `rgba(${rgb},0.95)`,
                  boxShadow: `0 0 12px rgba(${rgb},0.1)`,
                }}>
                <Icon className="h-3 w-3" />
                {label}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Subtitle ── */}
        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.68, duration: 0.55 }}
          className="text-base md:text-lg text-foreground-secondary max-w-[680px] mx-auto mb-10">
          An AI-powered enterprise platform that connects to your CRM, ERP, documents, emails, and internal systems — and transforms them into actionable, explainable business insights.
        </motion.p>

        {/* ── CTA buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.78, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link to="/signup"
            className="gradient-brand text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover-lift flex items-center gap-2 shadow-lg">
            Request Early Access <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#process"
            className="border border-border bg-background-surface/50 px-6 py-2.5 rounded-xl text-sm font-medium text-foreground hover-lift">
            Schedule a Demo
          </a>
        </motion.div>


        {/* ── Live metrics strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.5 }}
          className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 mb-14">
          {[
            { val: '6',    label: 'Industries Supported',  rgb: '59,130,246' },
            { val: '10+',  label: 'Data Integrations',     rgb: '6,182,212'  },
            { val: '89.3%',label: 'Forecast Accuracy',     rgb: '16,185,129' },
            { val: '100%', label: 'Data Stays Yours',      rgb: '139,92,246' },
          ].map(({ val, label, rgb }, i) => (
            <motion.div key={label} className="flex items-center gap-2"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 + i * 0.1 }}>
              {i > 0 && <span className="text-border hidden sm:inline">·</span>}
              <span className="text-base font-bold" style={{ color: `rgba(${rgb},0.95)` }}>{val}</span>
              <span className="text-sm text-foreground-secondary">{label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* ══════════════════════════════════════════
            DASHBOARD MOCKUP — unchanged content
        ══════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.8 }}
          className="relative">

          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute -inset-1 rounded-3xl blur-md opacity-40"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.6), rgba(6,182,212,0.4), rgba(139,92,246,0.5))' }} />

            <div className="relative glass-card p-5 rounded-2xl shadow-2xl animate-float" style={{ animationDuration: '8s' }}>
              {/* Top animated border */}
              <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.9), rgba(6,182,212,0.9), rgba(139,92,246,0.7), transparent)' }} />

              {/* ── Dashboard Header ── */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <motion.div className="h-2 w-2 rounded-full bg-success"
                    animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
                  <span className="text-xs font-semibold text-foreground">PulseIQ Analytics</span>
                </div>
                <div className="flex items-center gap-3">
                  {['7D','1M','3M'].map((t, i) => (
                    <span key={t} className={`text-[10px] font-medium px-2 py-0.5 rounded-md cursor-pointer ${i === 1 ? 'bg-primary/20 text-primary' : 'text-foreground-secondary'}`}>{t}</span>
                  ))}
                  <span className="text-[10px] text-foreground-secondary/50">Updated now</span>
                </div>
              </div>

              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-4 gap-2.5 mb-4">
                {[
                  { value: '247',   label: 'SKUs',     change: '+4.2%', bar: 'rgba(59,130,246,0.7)'  },
                  { value: '18',    label: 'Alerts',   change: '↓ 3',   bar: 'rgba(245,158,11,0.7)'  },
                  { value: '89.3%', label: 'Accuracy', change: '+1.1%', bar: 'rgba(16,185,129,0.7)'  },
                  { value: '74',    label: 'Health',   change: '+3 pts',bar: 'rgba(139,92,246,0.7)'  },
                ].map((kpi, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1 + i * 0.1 }}
                    className="relative overflow-hidden rounded-xl p-2.5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-medium text-foreground-secondary uppercase tracking-wider">{kpi.label}</span>
                      <span className="text-[9px] font-bold text-success">{kpi.change}</span>
                    </div>
                    <div className="text-base font-bold text-foreground">{kpi.value}</div>
                    <div className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, ${kpi.bar}, transparent)` }} />
                  </motion.div>
                ))}
              </div>

              {/* ── Charts Row ── */}
              <div className="grid grid-cols-3 gap-2.5">

                {/* Left — Animated Area Line Chart */}
                <div className="col-span-2 rounded-xl p-3 relative overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-foreground">Demand Forecast</span>
                    <span className="text-[10px] font-bold text-success">↑ 12.4%</span>
                  </div>
                  <svg viewBox="0 0 220 58" className="w-full" style={{ height: 58 }}>
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(59,130,246,0.38)" />
                        <stop offset="100%" stopColor="rgba(59,130,246,0.0)" />
                      </linearGradient>
                      <linearGradient id="line2Fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(6,182,212,0.22)" />
                        <stop offset="100%" stopColor="rgba(6,182,212,0.0)" />
                      </linearGradient>
                      <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(59,130,246,1)" />
                        <stop offset="100%" stopColor="rgba(6,182,212,1)" />
                      </linearGradient>
                    </defs>
                    {[14,28,42].map(y => (
                      <line key={y} x1="0" y1={y} x2="220" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    ))}
                    <motion.path
                      d="M0,52 C25,50 50,46 75,42 C100,38 125,40 150,36 C175,32 200,34 220,30 L220,58 L0,58 Z"
                      fill="url(#line2Fill)"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 1.6, duration: 0.6 }} />
                    <motion.path
                      d="M0,52 C25,50 50,46 75,42 C100,38 125,40 150,36 C175,32 200,34 220,30"
                      fill="none" stroke="rgba(6,182,212,0.45)" strokeWidth="1.2" strokeDasharray="4 3"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ delay: 1.5, duration: 1.2, ease: 'easeInOut' }} />
                    <motion.path
                      d="M0,50 C25,46 50,38 75,30 C100,24 125,26 150,18 C175,12 200,16 220,8 L220,58 L0,58 Z"
                      fill="url(#areaFill)"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 1.4, duration: 0.8 }} />
                    <motion.path
                      d="M0,50 C25,46 50,38 75,30 C100,24 125,26 150,18 C175,12 200,16 220,8"
                      fill="none" stroke="url(#strokeGrad)" strokeWidth="2" strokeLinecap="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                      transition={{ delay: 1.2, duration: 1.6, ease: 'easeInOut' }} />
                    {[[75,30],[150,18],[220,8]].map(([cx,cy], i) => (
                      <motion.circle key={i} cx={cx} cy={cy} r="2.8"
                        fill="rgba(59,130,246,1)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"
                        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 1.9 + i * 0.15 }} />
                    ))}
                  </svg>
                  <div className="flex justify-between mt-1 px-1">
                    {['Jan','Feb','Mar','Apr','May','Jun'].map(m => (
                      <span key={m} className="text-[8px] text-foreground-secondary/50">{m}</span>
                    ))}
                  </div>
                </div>

                {/* Right — Donut + mini bars */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex-1 rounded-xl p-2.5 flex flex-col items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-[9px] font-semibold text-foreground-secondary uppercase tracking-wider mb-1.5">AI Accuracy</span>
                    <div className="relative" style={{ width: 52, height: 52 }}>
                      <svg viewBox="0 0 52 52" style={{ width: 52, height: 52 }}>
                        <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="4" />
                        <motion.circle cx="26" cy="26" r="20" fill="none"
                          stroke="rgba(16,185,129,0.9)" strokeWidth="4"
                          strokeDasharray={`${2 * Math.PI * 20}`}
                          strokeLinecap="round"
                          transform="rotate(-90 26 26)"
                          initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - 0.893) }}
                          transition={{ delay: 1.5, duration: 1.4, ease: 'easeOut' }} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-foreground">89.3%</span>
                      </div>
                    </div>
                    <span className="text-[9px] text-success mt-1">↑ 1.1% this week</span>
                  </div>

                  <div className="rounded-xl p-2.5"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-[9px] font-semibold text-foreground-secondary uppercase tracking-wider block mb-2">SKU Health</span>
                    {[['Good', 0.74, 'rgba(16,185,129,0.8)'], ['At Risk', 0.18, 'rgba(245,158,11,0.8)'], ['Critical', 0.08, 'rgba(239,68,68,0.8)']].map(([label, pct, color]) => (
                      <div key={label} className="mb-1.5">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[8px] text-foreground-secondary">{label}</span>
                          <span className="text-[8px] text-foreground-secondary">{Math.round(Number(pct) * 100)}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <motion.div className="h-full rounded-full"
                            style={{ background: String(color) }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Number(pct) * 100}%` }}
                            transition={{ delay: 1.8, duration: 0.9, ease: 'easeOut' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom glow spread */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-primary/20 blur-3xl rounded-full" />
        </motion.div>

      </div>
    </section>
  );
};

export default HeroSection;
