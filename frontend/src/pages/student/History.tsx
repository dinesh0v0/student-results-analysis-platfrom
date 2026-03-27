import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookX } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FullPageLoader } from '../../components/ui/LoadingSpinner';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { useTheme } from '../../contexts/ThemeContext';
import api, { getApiErrorMessage, isRequestCanceled } from '../../lib/api';
import { AcademicHistory as AcademicHistoryType } from '../../types';
import { AccountHeader } from './AccountHeader';

export default function StudentHistory() {
  const [history, setHistory] = useState<AcademicHistoryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const { isDark } = useTheme();

  useEffect(() => {
    const controller = new AbortController();

    const fetchHistory = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const { data } = await api.get('/api/student/history', { signal: controller.signal });
        setHistory(data);
      } catch (error) {
        if (isRequestCanceled(error)) {
          return;
        }

        setErrorMessage(getApiErrorMessage(error, 'Unable to load academic history.'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
    return () => controller.abort();
  }, [retryToken]);

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (errorMessage) {
    return (
      <div className="space-y-6 animate-fade-in">
        <AccountHeader title="Academic History" subtitle="Track your performance across all semesters" />
        <StatusMessage
          title="Academic history unavailable"
          message={errorMessage}
          variant="error"
          actionLabel="Retry"
          onAction={() => setRetryToken((value) => value + 1)}
        />
      </div>
    );
  }

  if (!history || history.semesters.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <AccountHeader title="Academic History" subtitle="Track your performance across all semesters" />
        <Card className="flex flex-col items-center justify-center p-12 text-slate-500">
          <BookX className="mb-4 h-16 w-16 opacity-20" />
          <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">No History Available</h3>
          <p className="mt-2 max-w-md text-center">
            We could not find any past results for your account. This usually means your institution has not uploaded them yet.
          </p>
        </Card>
      </div>
    );
  }

  const trendData = history.semesters
    .map((semester) => ({
      name: `Sem ${semester.semester}`,
      percentage: parseFloat(semester.percentage.toFixed(2)),
      passed: semester.passed,
      failed: semester.failed,
      total: semester.total_subjects,
    }))
    .sort((left, right) => parseInt(left.name.split(' ')[1], 10) - parseInt(right.name.split(' ')[1], 10));

  const customTooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <AccountHeader title="Academic History" subtitle="Track your performance across all semesters" />

      <div className="grid gap-6 animate-slide-up lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overall Performance Trend (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} dy={10} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <Tooltip contentStyle={customTooltipStyle} cursor={{ stroke: isDark ? '#475569' : '#cbd5e1' }} />
                  <Line type="monotone" dataKey="percentage" name="Percentage" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1e293b' : '#ffffff' }} activeDot={{ r: 6, fill: '#6366f1' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credits Cleared vs Arrears</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: isDark ? '#334155' : '#f1f5f9' }} />
                  <Bar dataKey="passed" name="Subjects Passed" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} maxBarSize={40} />
                  <Bar dataKey="failed" name="Arrears" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <h3 className="mb-4 mt-8 text-xl font-bold text-slate-900 dark:text-white">Semester Breakdown</h3>
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {[...history.semesters].sort((left, right) => right.semester - left.semester).map((semester) => (
          <Card key={semester.semester} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <h4 className="text-lg font-bold">Semester {semester.semester}</h4>
              <div className="flex gap-4 text-sm font-medium">
                <span className="text-emerald-600 dark:text-emerald-400">Pass: {semester.passed}</span>
                <span className="text-red-600 dark:text-red-400">Fail: {semester.failed}</span>
                <span className="ml-2 text-indigo-600 dark:text-indigo-400">{semester.percentage.toFixed(1)}%</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/30 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Code</th>
                      <th className="px-6 py-3 font-medium">Subject Name</th>
                      <th className="px-6 py-3 text-right font-medium">Marks</th>
                      <th className="px-6 py-3 text-center font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {history.results
                      .filter((result) => result.semester === semester.semester)
                      .map((result) => (
                        <tr key={result.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-6 py-3 font-mono text-slate-500">{result.subject_code}</td>
                          <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{result.subject_name}</td>
                          <td className="px-6 py-3 text-right">
                            <span className="font-bold text-slate-900 dark:text-white">{result.marks_obtained ?? '-'}</span>
                            <span className="mx-1 text-slate-400">/</span>
                            <span className="text-slate-500">{result.max_marks}</span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                                result.pass_status
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              {result.grade || (result.pass_status ? 'PASS' : 'FAIL')}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
