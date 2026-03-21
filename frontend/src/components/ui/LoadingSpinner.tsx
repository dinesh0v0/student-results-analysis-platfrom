import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './Card';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export function LoadingSpinner({ className, size = 24 }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex justify-center items-center p-8", className)}>
      <Loader2 
        className="animate-spin text-indigo-500" 
        style={{ width: size, height: size }} 
      />
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">Loading...</p>
      </div>
    </div>
  );
}
