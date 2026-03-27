import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

import { Button } from './Button';
import { Card, CardContent, cn } from './Card';

interface StatusMessageProps {
  title: string;
  message: string;
  variant?: 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function StatusMessage({
  title,
  message,
  variant = 'info',
  actionLabel,
  onAction,
  className,
}: StatusMessageProps) {
  const isError = variant === 'error';
  const Icon = isError ? AlertTriangle : Info;

  return (
    <Card
      className={cn(
        'border p-6',
        isError
          ? 'border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
          : 'border-slate-200 bg-slate-50/80 text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100',
        className
      )}
    >
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full',
            isError
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          )}
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm opacity-80">{message}</p>
        </div>

        {actionLabel && onAction ? (
          <Button variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
