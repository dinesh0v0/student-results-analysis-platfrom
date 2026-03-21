import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { GraduationCap, Sun, Moon, LogOut, Menu } from 'lucide-react';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout } = useAuth();
  const { isDark, setTheme } = useTheme();
  const location = useLocation();

  const isAuthPage = location.pathname.includes('/login') || location.pathname.includes('/register');

  return (
    <nav className="sticky top-0 z-40 glass-panel border-b border-slate-200 dark:border-slate-800 px-4 h-16 flex items-center justify-between transition-colors duration-300">
      <div className="flex items-center gap-3">
        {user && onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 lg:hidden transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        
        <Link 
          to={user?.role === 'admin' ? '/admin' : user?.role === 'student' ? '/student' : '/'} 
          className="flex items-center gap-2 group"
        >
          <div className="bg-indigo-600 text-white p-2 rounded-xl group-hover:bg-indigo-700 transition-colors shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg hidden sm:block tracking-tight text-slate-900 dark:text-white">
            Result<span className="text-indigo-600 dark:text-indigo-400">Sphere</span>
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {!user && !isAuthPage && (
          <Link 
            to="/auth/student/login" 
            className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
          >
            Student Login
          </Link>
        )}

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                {user.email}
              </span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium capitalize">
                {user.role}
              </span>
            </div>
            
            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
