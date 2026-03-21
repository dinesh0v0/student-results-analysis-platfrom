import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/layout/Navbar';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { useAuth } from './contexts/AuthContext';
import { FullPageLoader } from './components/ui/LoadingSpinner';

// Lazy loading pages for better performance
const Landing = React.lazy(() => import('./pages/Landing'));
const AdminLogin = React.lazy(() => import('./pages/auth/AdminLogin'));
const AdminSignup = React.lazy(() => import('./pages/auth/AdminSignup'));
const StudentLogin = React.lazy(() => import('./pages/auth/StudentLogin'));
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const AdminUpload = React.lazy(() => import('./pages/admin/Upload'));
const StudentLookup = React.lazy(() => import('./pages/admin/StudentLookup'));
const StudentDashboard = React.lazy(() => import('./pages/student/Dashboard'));
const StudentHistory = React.lazy(() => import('./pages/student/History'));
const StudentReport = React.lazy(() => import('./pages/student/Report'));

// A simple layout wrapper for non-dashboard pages (Landing, Auth)
const PublicLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1 flex flex-col relative">{children}</main>
  </div>
);

// Protect public routes from authenticated users
const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <FullPageLoader />;
  
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      {/* Toast notifications portal */}
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'dark:bg-slate-800 dark:text-white dark:border dark:border-slate-700',
          duration: 4000,
        }} 
      />
      
      <React.Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={
            <PublicOnlyRoute>
              <PublicLayout><Landing /></PublicLayout>
            </PublicOnlyRoute>
          } />
          
          <Route path="/auth/admin/login" element={
            <PublicOnlyRoute>
              <PublicLayout><AdminLogin /></PublicLayout>
            </PublicOnlyRoute>
          } />
          
          <Route path="/auth/admin/register" element={
            <PublicOnlyRoute>
              <PublicLayout><AdminSignup /></PublicLayout>
            </PublicOnlyRoute>
          } />
          
          <Route path="/auth/student/login" element={
            <PublicOnlyRoute>
              <PublicLayout><StudentLogin /></PublicLayout>
            </PublicOnlyRoute>
          } />

          {/* Admin Dashboard Routes */}
          <Route path="/admin" element={<DashboardLayout requiredRole="admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="upload" element={<AdminUpload />} />
            <Route path="students" element={<StudentLookup />} />
          </Route>

          {/* Student Dashboard Routes */}
          <Route path="/student" element={<DashboardLayout requiredRole="student" />}>
            <Route index element={<StudentDashboard />} />
            <Route path="history" element={<StudentHistory />} />
            <Route path="report" element={<StudentReport />} />
          </Route>
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;
