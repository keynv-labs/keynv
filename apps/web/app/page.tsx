import { isHostedInstance } from '@/lib/hosted';
import { getSession } from '@/lib/session';
import { Github, LogIn, Mail, ShieldCheck, Terminal, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
});

const TITLE = 'keynv — developer-first secrets management';
const DESCRIPTION =
  'Store API keys, database credentials, and secrets in one vault. Use safe aliases everywhere.';
const GITHUB_URL = 'https://github.com/keynv-labs/keynv';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
};

export default async function LandingPage() {
  // Self-host is the default: the root is the app, not a marketing page.
  // Send visitors straight to the panel (or login). Only the hosted keynv
  // Cloud instance (KEYNV_HOSTED=true) renders the marketing landing below.
  if (!isHostedInstance()) {
    const session = await getSession();
    redirect(session ? '/dashboard' : '/login');
  }

  return (
    <div
      className={`min-h-screen bg-[#fafafa] text-[#1a1a1a] selection:bg-orange-100 ${poppins.className}`}
    >
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-50/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-[120px]" />
      </div>

      <main className="relative z-10 max-w-[1400px] mx-auto px-6 flex flex-col items-center justify-center min-h-screen">
        {/* Hero Section */}
        <div className="text-center mt-24 space-y-8 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-7xl md:text-9xl font-semibold tracking-tighter text-black lowercase italic">
            keynv<span className="text-orange-500 not-italic">.</span>
          </h1>

          <p className="max-w-[500px] mx-auto text-lg md:text-xl text-black/50 leading-relaxed font-light">
            {DESCRIPTION}
          </p>

          {/* Primary actions */}
          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={{ pathname: '/login' }}
                className="group flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-orange-500 text-white hover:bg-orange-600 transition-all duration-300 shadow-xl shadow-orange-500/10"
              >
                <LogIn size={18} />
                <span className="text-sm font-medium">Sign in</span>
              </Link>
              <Link
                href={GITHUB_URL}
                className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-black text-white hover:bg-black/80 transition-all duration-300 shadow-xl shadow-black/5"
              >
                <Github className="text-white" size={20} />
                <span className="text-sm font-medium text-white">View on GitHub</span>
              </Link>
            </div>

            <div className="flex items-center gap-8 text-[12px] text-black/40 uppercase tracking-widest font-medium pt-2">
              <div className="flex flex-col items-center gap-1">
                <span>Core Devs</span>
                <span className="text-black/80">Keynv Labs</span>
              </div>
              <div className="h-6 w-[1px] bg-black/[0.05]" />
              <div className="flex flex-col items-center gap-1">
                <span>License</span>
                <span className="text-black/80">MIT / BSL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Soft Divider */}
        <div className="w-full max-w-[600px] h-px bg-gradient-to-r from-transparent via-black/[0.05] to-transparent mb-20" />

        {/* Minimal Feature Grid */}
        <div className="grid md:grid-cols-3 gap-12 w-full max-w-[1000px] mb-32">
          <Feature
            icon={<Terminal size={20} />}
            title="Safe Aliases"
            desc="Use @prod.db_pass instead of raw strings in your code."
          />
          <Feature
            icon={<ShieldCheck size={20} />}
            title="Zero Trust"
            desc="Secrets are resolved at runtime, never stored in shell history."
          />
          <Feature
            icon={<Zap size={20} />}
            title="AI Ready"
            desc="Seamlessly integrate with Claude Code, Cursor, and MCP."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-black/[0.03] bg-white/30 backdrop-blur-md">
        <div className="max-w-[1080px] mx-auto px-8 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6 text-[13px] text-black/40">
            <span>© {new Date().getFullYear()} Keynv Labs</span>
            <Link href="/docs" className="hover:text-black transition-colors">
              Documentation
            </Link>
            <Link href={{ pathname: '/login' }} className="hover:text-black transition-colors">
              Sign in
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="mailto:hello@keynv.dev"
              className="flex items-center gap-2 text-sm text-black/60 hover:text-black transition-colors"
            >
              <Mail size={16} />
              <span>hello@keynv.dev</span>
            </a>
            <div className="flex items-center gap-4">
              <Link
                href={GITHUB_URL}
                className="p-2 rounded-full hover:bg-black/[0.03] transition-colors"
                aria-label="keynv on GitHub"
              >
                <Github size={18} className="text-black/40" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-4 group">
      <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-black/[0.03] text-black/40 group-hover:text-orange-500 group-hover:border-orange-100 transition-all duration-500 shadow-sm">
        {icon}
      </div>
      <h3 className="text-sm font-semibold tracking-tight text-black">{title}</h3>
      <p className="text-sm text-black/40 leading-relaxed font-light">{desc}</p>
    </div>
  );
}
