import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { FullPageLoader } from '../ui/LoadingSpinner';
import { ChatBot } from '../ai/ChatBot';

interface DashboardLayoutProps {
  requiredRole: 'admin' | 'student';
}

export function DashboardLayout({ requiredRole }: DashboardLayoutProps) {
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) return <FullPageLoader />;

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          role={requiredRole} 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
        
        {/* Main Content Area */}
        <main className="flex-1 w-full overflow-y-auto lg:ml-64 relative">
          <div className="container mx-auto p-4 md:p-6 lg:p-8 animate-fade-in max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Global Floating AI Assistant */}
      <ChatBot />
    </div>
  );
}
