'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, KeyRound, ShieldCheck, Activity, Terminal, Users, Boxes, 
  CheckCircle2, X, Lock, GitBranch, Puzzle, Sliders, ChevronLeft, ChevronRight,
  Shield, Zap, EyeOff, UserCheck, LayoutGrid, Folder, CreditCard, BookOpen, Settings, Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PortalHeader } from '@/features/landing/components/PortalHeader';
import { HeroSection } from '@/features/landing/components/HeroSection';
import { AppEcosystem } from '@/features/landing/components/AppEcosystem';
import { AuthFlowTerminal } from '@/features/landing/components/AuthFlowTerminal';

const CORE_PILLARS_ROW = [
  { icon: Lock, title: 'Self-hosted', desc: 'You own it. You run it. Your data stays yours.' },
  { icon: GitBranch, title: 'Open Standards', desc: 'Built on OpenID Connect & OAuth 2.1' },
  { icon: Puzzle, title: 'Easy to Integrate', desc: 'Simple SDKs and clear documentation' },
  { icon: Sliders, title: 'Full Control', desc: 'Manage users, clients and policies your way' },
  { icon: UserCheck, title: 'User Data Ownership', desc: 'Users can export or delete their data anytime' },
];

const CONSOLE_CARDS = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Analytics and insights at a glance', icon: LayoutGrid, isDev: false },
  { id: 'projects', label: 'Projects', desc: 'Manage and ship your projects', icon: Folder, isDev: false },
  { id: 'billing', label: 'Billing', desc: 'Manage subscriptions and invoices', icon: CreditCard, isDev: false },
  { id: 'api', label: 'API Console', desc: 'Test and explore our APIs', icon: Code, isDev: true },
  { id: 'docs', label: 'Docs', desc: 'Guides and documentation', icon: BookOpen, isDev: true },
  { id: 'users', label: 'Users', desc: 'Manage users and permissions', icon: Users, isDev: false },
  { id: 'settings', label: 'Settings', desc: 'Configure OID to fit your needs', icon: Settings, isDev: false },
  { id: 'logs', label: 'Logs', desc: 'Monitor and audit system logs', icon: Activity, isDev: true },
];

const TESTIMONIALS = [
  {
    quote: "OID is exactly what we needed. Easy to self-host, simple to integrate, and super reliable.",
    author: "Sarah Chen",
    role: "Developer",
    avatar: "SC"
  },
  {
    quote: "Our users love the control over their data. And we love how fast and secure it is.",
    author: "James Wilson",
    role: "CTO, Acme Inc.",
    avatar: "JW"
  },
  {
    quote: "The documentation is amazing and the community is super helpful.",
    author: "Priya Patel",
    role: "Indie Developer",
    avatar: "PP"
  }
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<'user' | 'dev'>('user');
  const [connectedAppsCount, setConnectedAppsCount] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);
  const [showFullEcosystem, setShowFullEcosystem] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [activeConsoleCard, setActiveConsoleCard] = useState<string | null>(null);

  const nextTestimonial = () => {
    setTestimonialIndex((p) => (p + 1) % TESTIMONIALS.length);
  };

  const prevTestimonial = () => {
    setTestimonialIndex((p) => (p - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="eyebrow text-muted-foreground animate-pulse">ESTABLISHING ID SESSION…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* dot-grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.25] dark:opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Global Header Navigation */}
      <PortalHeader mode={mode} onModeChange={setMode} />

      {/* Notification Banner */}
      {notification && (
        <div className="relative z-30 mx-auto max-w-7xl px-6 mt-4">
          <div className="flex items-center justify-between border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-600 shadow-sm rounded-xl dark:text-emerald-400">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="size-5 shrink-0" />
              <p className="text-xs font-mono font-bold">{notification}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="border border-emerald-500/30 bg-card/85 p-1 rounded-lg hover:bg-emerald-500/10 transition-all cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Hero Section */}
      <HeroSection user={user} connectedAppsCount={connectedAppsCount} mode={mode} />

      {/* Section 1: Core Pillars Row (Mockup's horizontal cards) */}
      <section className="relative z-10 bg-secondary/20 border-y border-border/40 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {CORE_PILLARS_ROW.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div 
                  key={idx} 
                  className="flex flex-col text-left p-6 bg-card border border-border/60 rounded-2xl shadow-brutal-xs hover:border-primary/40 transition-all duration-300 group"
                >
                  <span className="size-9 flex items-center justify-center bg-muted border rounded-xl mb-4 text-foreground/80 group-hover:bg-primary group-hover:text-background transition-colors duration-300">
                    <Icon className="size-4.5" />
                  </span>
                  <h4 className="font-heading font-extrabold text-xs tracking-tight mb-1">{item.title}</h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: App/Console Grid Section */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-20 grid gap-12 lg:grid-cols-12 items-start border-b border-border/40">
        {/* Left Column: Heading and Info */}
        <div className="lg:col-span-4 text-left flex flex-col justify-between h-full">
          <div>
            <span className="eyebrow inline-block border border-primary/10 bg-primary/5 px-3 py-1 rounded-full text-foreground/80 mb-4 font-bold">
              All in one access
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              One account.<br />Access all your apps.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-md">
              Sign in once with OID and access all your tools and applications seamlessly. Revoke app tokens or analyze scopes dynamically.
            </p>
          </div>
          
          <div>
            <button 
              onClick={() => setShowFullEcosystem(!showFullEcosystem)}
              className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full font-heading text-xs font-bold tracking-wider uppercase transition-all duration-300 group shadow-md hover:scale-102 cursor-pointer"
            >
              {showFullEcosystem ? 'Collapse apps list' : 'Explore all apps'}
              <ArrowRight className={`size-4 transition-transform duration-300 ${showFullEcosystem ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Right Column: Console Cards Grid */}
        <div className="lg:col-span-8 flex flex-col gap-6 w-full">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {CONSOLE_CARDS.map((card) => {
              const Icon = card.icon;
              // Dim cards that don't belong to the active navbar mode
              const isDimmed = mode === 'dev' ? !card.isDev : card.isDev;
              const isActive = activeConsoleCard === card.id;

              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (card.isDev && mode === 'dev') {
                      setActiveConsoleCard(isActive ? null : card.id);
                    } else if (card.id === 'dashboard') {
                      setShowFullEcosystem(true);
                      document.getElementById('ecosystem-panel')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={`flex flex-col justify-between p-5 border rounded-2xl cursor-pointer text-left transition-all duration-300 relative group h-36 ${
                    isActive 
                      ? 'bg-primary text-background border-primary shadow-brutal' 
                      : isDimmed
                        ? 'bg-card/30 border-border/30 opacity-40 hover:opacity-75 scale-98'
                        : 'bg-card border-border/80 hover:border-primary/50 shadow-brutal-sm hover:-translate-y-1'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`p-2 rounded-xl border ${
                      isActive ? 'bg-background text-foreground border-transparent' : 'bg-muted border-border/30 text-foreground/80'
                    }`}>
                      <Icon className="size-4.5" />
                    </span>
                    <ArrowRight className={`size-4 -rotate-45 transition-transform duration-300 ${
                      isActive ? 'text-background' : 'text-muted-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                    }`} />
                  </div>
                  <div>
                    <h4 className={`font-heading font-extrabold text-xs tracking-tight ${
                      isActive ? 'text-background' : 'text-foreground'
                    }`}>
                      {card.label}
                    </h4>
                    <p className={`text-[10px] mt-1 leading-snug ${
                      isActive ? 'text-background/80' : 'text-muted-foreground'
                    }`}>
                      {card.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dynamic Dev Logs / Sandbox Reveal */}
          <AnimatePresence>
            {mode === 'dev' && activeConsoleCard === 'logs' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <AuthFlowTerminal />
              </motion.div>
            )}
            {mode === 'dev' && activeConsoleCard === 'api' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="p-6 border border-primary/20 bg-[#0B0F19] rounded-2xl text-left"
              >
                <h4 className="font-heading text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Terminal className="size-4 text-emerald-400" /> API Playground
                </h4>
                <p className="text-xs text-slate-400 mb-4">Copy your authorization endpoints to wire your SDK integrations.</p>
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-emerald-400 overflow-x-auto">
                  {`curl -X POST https://id.anand.dev/oauth/token \\
  -d "grant_type=authorization_code" \\
  -d "client_id=acme_app" \\
  -d "code_challenge=PKCE_CHALLENGE"`}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Expanded App Ecosystem Drawer section */}
      <AnimatePresence>
        {showFullEcosystem && (
          <motion.section 
            id="ecosystem-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative z-10 border-b border-border/40 bg-secondary/15 overflow-hidden"
          >
            <div className="mx-auto max-w-7xl px-6 py-12">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h3 className="font-heading text-lg font-bold">App Ecosystem Consents</h3>
                  <p className="text-xs text-muted-foreground mt-1">Review permissions and disconnect apps you no longer trust.</p>
                </div>
                <button 
                  onClick={() => setShowFullEcosystem(false)}
                  className="p-1.5 border border-border/80 rounded-lg hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
              <AppEcosystem user={user} onAppsChanged={setConnectedAppsCount} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Section 3: "Why OID" Dark Feature Band */}
      <section className="bg-neutral-950 text-white py-16 border-y border-white/5 relative z-10">
        <div className="mx-auto max-w-7xl px-6 grid gap-12 lg:grid-cols-12 items-center">
          <div className="lg:col-span-4 text-left">
            <span className="eyebrow inline-block border border-white/10 bg-white/5 px-3 py-1 rounded-full text-white/60 mb-3">
              Why OID
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">
              Built for developers.<br />Loved by users.
            </h2>
          </div>
          <div className="lg:col-span-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[
              { title: 'Blazing Fast', desc: 'Optimized for speed and low latency.', icon: Zap },
              { title: 'Enterprise Ready', desc: 'Scalable, reliable and ready for production.', icon: Shield },
              { title: 'Privacy First', desc: 'Minimal data collection. Maximum privacy.', icon: EyeOff },
              { title: 'User Empowerment', desc: 'Users control their data and identity.', icon: UserCheck }
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex flex-col text-left">
                  <span className="size-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl mb-4 text-white">
                    <Icon className="size-5" />
                  </span>
                  <h4 className="font-heading font-bold text-sm tracking-tight mb-1">{item.title}</h4>
                  <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 4: "Security. Privacy. Performance" Section */}
      <section id="security" className="py-20 mx-auto max-w-7xl px-6 grid gap-12 lg:grid-cols-12 items-center border-b border-border/40 relative z-10">
        <div className="lg:col-span-5 flex items-center justify-center">
          <div className="relative size-60 bg-foreground/5 dark:bg-white/5 border flex items-center justify-center animate-warp-slow shadow-brutal-lg max-w-full">
            <div className="absolute inset-2 bg-card rounded-full flex items-center justify-center">
              <Lock className="size-14 text-foreground animate-pulse" />
            </div>
          </div>
        </div>
        <div className="lg:col-span-7 flex flex-col justify-center text-left">
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Security. Privacy. Performance.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mb-8">
            OID gives you all the tools you need to manage identity securely while giving users full control over their data.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { title: 'End-to-end security', desc: 'Best practices, always.', icon: ShieldCheck },
              { title: 'Users own their data', desc: 'Export or delete anytime.', icon: Zap },
              { title: 'High availability', desc: '99.99% uptime and counting.', icon: Activity },
              { title: 'Open source', desc: 'Transparent and community-driven.', icon: GitBranch }
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex gap-4">
                  <span className="size-10 shrink-0 flex items-center justify-center bg-muted border rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <div className="flex flex-col">
                    <h4 className="font-heading font-bold text-sm tracking-tight">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 5: Testimonial Carousel Section */}
      <section className="py-20 bg-secondary/10 border-b border-border/40 flex flex-col items-center text-center relative z-10">
        <span className="eyebrow border border-primary/10 bg-primary/5 px-3 py-1 rounded-full text-foreground/80 mb-4 font-bold">
          Loved by developers
        </span>
        <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight mb-12">
          What people say about OID
        </h2>
        
        <div className="relative flex items-center justify-center w-full max-w-4xl px-4 gap-4">
          <button 
            onClick={prevTestimonial}
            className="size-10 rounded-full border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="relative overflow-hidden w-full max-w-2xl px-6 sm:px-12 py-10 bg-black dark:bg-card text-white dark:text-foreground rounded-3xl border border-border shadow-brutal flex flex-col justify-center min-h-[240px]">
            <div className="absolute top-4 left-6 text-5xl font-serif text-white/10 dark:text-foreground/5 select-none">“</div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonialIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col justify-between"
              >
                <p className="font-heading text-base sm:text-lg font-medium tracking-tight leading-relaxed italic text-white/90 dark:text-foreground/90 text-left">
                  {TESTIMONIALS[testimonialIndex].quote}
                </p>
                
                <div className="mt-8 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center bg-white text-black dark:bg-primary dark:text-background font-heading font-black text-xs rounded-full">
                    {TESTIMONIALS[testimonialIndex].avatar}
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-heading font-bold text-white dark:text-foreground">{TESTIMONIALS[testimonialIndex].author}</span>
                    <span className="text-[10px] font-mono text-white/50 dark:text-muted-foreground">{TESTIMONIALS[testimonialIndex].role}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <button 
            onClick={nextTestimonial}
            className="size-10 rounded-full border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="flex gap-2 mt-6">
          {TESTIMONIALS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setTestimonialIndex(idx)}
              className={`size-2 rounded-full transition-all duration-300 ${testimonialIndex === idx ? 'bg-primary w-4' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </div>
      </section>

      {/* Section 6: CTA Banner & Footer Section */}
      <section className="py-20 mx-auto max-w-7xl px-6 relative z-10">
        <div className="bg-secondary/40 border border-border/50 p-12 md:p-16 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 shadow-md">
          <div className="flex flex-col text-left max-w-xl relative z-10">
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to take control of identity?
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mt-4">
              Get started with OID and give your users a secure, seamless sign-in experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href={user ? "/account" : "/login"}>
                <button className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-black/90 text-white rounded-full font-heading text-xs font-bold tracking-wider uppercase transition-all duration-300 shadow-md hover:scale-102 cursor-pointer">
                  Get Started Now
                  <ArrowRight className="size-4" />
                </button>
              </Link>
            </div>
          </div>
          
          <div className="relative size-44 bg-muted border flex items-center justify-center animate-warp-medium shadow-brutal shrink-0">
            <div className="absolute inset-1.5 bg-card rounded-full" />
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      <footer className="border-t border-border/30 bg-secondary/15 py-16 relative z-10">
        <div className="mx-auto max-w-7xl px-6 grid gap-12 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6">
          <div className="md:col-span-2 flex flex-col text-left">
            <Link href="/" className="font-heading text-xl font-bold tracking-tight flex items-center gap-2 select-none group mb-4">
              <svg className="size-6 text-foreground fill-current transition-transform duration-500 group-hover:rotate-12" viewBox="0 0 24 24">
                <path d="M8 15a3.5 3.5 0 1 1 3.5 3.5c-1.93 0-3.5-1.57-3.5-3.5zm7.5-6a5 5 0 1 1 5 5c-2.76 0-5-2.24-5-5z" />
              </svg>
              <span className="font-black text-2xl tracking-tighter">OID</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mb-6">
              A self-hosted OpenID Connect provider for modern applications. Own your identity data.
            </p>
            <div className="flex gap-4 text-muted-foreground">
              <a href="https://github.com" className="hover:text-foreground transition-colors"><Code className="size-4" /></a>
              <a href="https://discord.com" className="hover:text-foreground transition-colors"><Activity className="size-4" /></a>
              <a href="https://twitter.com" className="hover:text-foreground transition-colors"><ArrowRight className="size-4" /></a>
              <a href="mailto:info@oid.dev" className="hover:text-foreground transition-colors"><Lock className="size-4" /></a>
            </div>
          </div>

          {[
            {
              title: 'Product',
              links: [
                { label: 'Features', href: '#features' },
                { label: 'Security', href: '#security' },
                { label: 'Pricing', href: '#' },
                { label: 'Changelog', href: '#' }
              ]
            },
            {
              title: 'Resources',
              links: [
                { label: 'Documentation', href: '#docs' },
                { label: 'Guides', href: '#' },
                { label: 'API Reference', href: '#' },
                { label: 'Blog', href: '#' }
              ]
            },
            {
              title: 'Community',
              links: [
                { label: 'GitHub', href: 'https://github.com' },
                { label: 'Discussions', href: '#' },
                { label: 'Contributing', href: '#' },
                { label: 'Support', href: '#' }
              ]
            },
            {
              title: 'Legal',
              links: [
                { label: 'Privacy Policy', href: '#' },
                { label: 'Terms of Service', href: '#' },
                { label: 'Data Deletion', href: '#' },
                { label: 'License', href: '#' }
              ]
            }
          ].map((col, idx) => (
            <div key={idx} className="flex flex-col text-left">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-foreground mb-4">{col.title}</h4>
              <div className="flex flex-col gap-2.5">
                {col.links.map((link, lIdx) => (
                  <Link key={lIdx} href={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mx-auto max-w-7xl px-6 border-t border-border/20 pt-8 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© 2026 OID. All rights reserved.</span>
          <span className="font-mono uppercase tracking-wider">Single ID · Many Tools · Privacy First</span>
        </div>
      </footer>
    </div>
  );
}
