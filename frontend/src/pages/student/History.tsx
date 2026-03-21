import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FullPageLoader } from '../../components/ui/LoadingSpinner';
import { AccountHeader } from './AccountHeader';
import { AcademicHistory as AcademicHistoryType } from '../../types';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { BookX } from 'lucide-react';

export default function StudentHistory() {
  const [history, setHistory] = useState<AcademicHistoryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isDark } = useTheme();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get('/api/student/history');
        setHistory(data);
      } catch (error: any) {
        if (error.response?.status !== 404) {
          toast.error('Failed to load academic history.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (isLoading) return <FullPageLoader />;

  if (!history || history.semesters.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <AccountHeader title="Academic History" subtitle="Track your performance across all semesters" />
        <Card className="flex flex-col items-center justify-center p-12 text-slate-500">
          <BookX className="w-16 h-16 mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300">No History Available</h3>
          <p className="mt-2 text-center max-w-md">We couldn't find any past results for your account. This usually means your institution hasn't uploaded them yet.</p>
        </Card>
      </div>
    );
  }

  // Transform data for charts
  const gpaTrendData = history.semesters.map(sem => ({
    name: `Sem ${sem.semester}`,
    percentage: parseFloat(sem.percentage.toFixed(2)),
    passed: sem.passed,
    failed: sem.failed,
    total: sem.total_subjects
  })).sort((a, b) => {
     // Sort by semester number extracted from name
     return parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]);
  });

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

      <div className="grid lg:grid-cols-2 gap-6 animate-slide-up">
        
        {/* Performance Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Performance Trend (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gpaTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} dy={10} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <Tooltip contentStyle={customTooltipStyle} cursor={{ stroke: isDark ? '#475569' : '#cbd5e1' }} />
                  <Line 
                    type="monotone" 
                    dataKey="percentage" 
                    name="Percentage" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1e293b' : '#ffffff' }} 
                    activeDot={{ r: 6, fill: '#6366f1' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pass/Fail Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Credits Cleared vs Arrears</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gpaTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <Tooltip 
                    contentStyle={customTooltipStyle} 
                    cursor={{ fill: isDark ? '#334155' : '#f1f5f9' }} 
                  />
                  <Bar dataKey="passed" name="Subjects Passed" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} maxBarSize={40} />
                  <Bar dataKey="failed" name="Arrears" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Detailed Semester Breakdown */}
      <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">Semester Breakdown</h3>
      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {history.semesters.sort((a,b) => b.semester - a.semester).map((sem) => (
          <Card key={sem.semester} className="overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between py-4">
              <h4 className="font-bold text-lg">Semester {sem.semester}</h4>
              <div className="flex gap-4 text-sm font-medium">
                <span className="text-emerald-600 dark:text-emerald-400">Pass: {sem.passed}</span>
                <span className="text-red-600 dark:text-red-400">Fail: {sem.failed}</span>
                <span className="text-indigo-600 dark:text-indigo-400 ml-2">{sem.percentage.toFixed(1)}%</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left whitespace-nowrap">
                   <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/30 dark:text-slate-400">
                     <tr>
                       <th className="px-6 py-3 font-medium">Code</th>
                       <th className="px-6 py-3 font-medium">Subject Name</th>
                       <th className="px-6 py-3 font-medium text-right">Marks</th>
                       <th className="px-6 py-3 font-medium text-center">Grade</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                     {history.results.filter(r => r.semester === sem.semester).map((r, i) => (
                       <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                         <td className="px-6 py-3 font-mono text-slate-500">{r.subject_code}</td>
                         <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{r.subject_name}</td>
                         <td className="px-6 py-3 text-right">
                            <span className="font-bold text-slate-900 dark:text-white">{r.marks_obtained ?? '-'}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-slate-500">{r.max_marks}</span>
                         </td>
                         <td className="px-6 py-3 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              r.pass_status ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {r.grade || (r.pass_status ? 'PASS' : 'FAIL')}
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
