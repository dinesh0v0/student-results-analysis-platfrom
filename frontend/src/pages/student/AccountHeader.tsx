import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserCircle } from 'lucide-react';

interface AccountHeaderProps {
  title: string;
  subtitle?: string;
}

export function AccountHeader({ title, subtitle }: AccountHeaderProps) {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-2 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      
      {user && (
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 self-start md:self-auto">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <UserCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight capitalize">{user.email?.split('@')[0] || 'Student'}</p>
            <p className="text-xs text-slate-500 font-mono">ID: {user.student_id || '----'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
