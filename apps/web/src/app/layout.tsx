import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Platform Infrastructure Status',
  description: 'Authoritative rental infrastructure cluster health and control dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-950 text-slate-100">
      <body className="min-h-full flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-slate-950 shadow-md shadow-indigo-500/20">
                P
              </div>
              <div>
                <span className="font-semibold text-white tracking-tight block leading-tight">
                  Platform Core
                </span>
                <span className="text-xs text-slate-400 font-mono">Phase 1 Infrastructure</span>
              </div>
            </div>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <a
                href="http://localhost:4000/api/docs"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-xs font-mono text-cyan-300 transition-colors"
              >
                Swagger API Docs &rarr;
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {children}
        </main>
        <footer className="border-t border-slate-850 py-6 text-center text-xs text-slate-500 font-mono">
          Rental Lifecycle Engine &bull; PostgreSQL Authoritative Ledger &bull; Phase 1 Scaffold
        </footer>
      </body>
    </html>
  );
}
