import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { BarChart3, ShieldCheck, Zap, ArrowRight, Bot } from 'lucide-react';

export default function Landing() {
  return (
    <div className="flex-1 flex flex-col pt-16 pb-24 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/2 -ml-[39rem] w-[78rem] h-[50rem] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-[100px] mix-blend-multiply opacity-20 dark:opacity-10 translate-y-[-20%]"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex-1 flex flex-col justify-center max-w-6xl">
        
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto space-y-8 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-4 ring-1 ring-inset ring-indigo-500/20">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
            Seamless Result Management for 2026
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
            Unlock Academic Insights with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">ResultSphere</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            The modern, multi-tenant platform for universities to manage, visualize, and analyze student results effortlessly. Powered by AI and real-time analytics.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/auth/admin/register">
              <Button size="lg" className="w-full sm:w-auto text-base">
                Register Institution <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </Link>
            <Link to="/auth/admin/login">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base">
                Admin Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-6">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Rich Analytics</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Visualize grade distributions, trace subject performance across semesters, and identify top achievers instantly.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Multi-Tenant Security</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Enterprise-grade Row Level Security ensures your institution's data remains completely isolated and secure.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-6">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">AI Assistant</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Ask natural language questions about your data. The integrated Gemini AI finds the answers instantly.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
