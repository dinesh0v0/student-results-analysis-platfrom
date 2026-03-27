import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UploadCloud, FileText, BarChart3 } from 'lucide-react';
import { cn } from '../ui/Card';

interface SidebarProps {
  role: 'admin' | 'student';
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/admin/students', icon: Users, label: 'Students Lookup' },
    { to: '/admin/upload', icon: UploadCloud, label: 'Upload & Manage' },
  ];

  const studentLinks = [
    { to: '/student', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/student/history', icon: BarChart3, label: 'Academic History' },
    { to: '/student/report', icon: FileText, label: 'PDF Report' },
  ];

  const links = role === 'admin' ? adminLinks : studentLinks;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar sidebar */}
      <aside 
        className={cn(
          "fixed top-16 bottom-0 left-0 z-30 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 px-3 mt-2">
            Menu
          </div>
          
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onClose}
                end={link.exact}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <link.icon className={cn("w-5 h-5", "opacity-80")} />
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        
        <div className="absolute bottom-4 left-4 right-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-semibold mb-1 text-slate-700 dark:text-slate-300">ResultSphere v1.0</p>
            <p>Protected by Supabase RLS.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
