import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FullPageLoader } from '../../components/ui/LoadingSpinner';
import { DashboardResponse, AdminDashboardStats } from '../../types';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Users, BookOpen, FileCheck, Target } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [semester, setSemester] = useState<number | 'all'>('all');
  const { isDark } = useTheme();

  const fetchDashboard = async (sem: number | 'all') => {
    setIsLoading(true);
    try {
      const url = sem === 'all' ? '/api/admin/dashboard' : `/api/admin/dashboard?semester=${sem}`;
      const response = await api.get(url);
      setData(response.data);
    } catch (error: any) {
      toast.error('Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(semester);
  }, [semester]);

  if (isLoading && !data) return <FullPageLoader />;
  if (!data) return <div className="text-center p-8">No data available. Please upload results.</div>;

  const { stats, grade_distribution, subject_performance, top_performers } = data;

  // Custom Tooltip Style
  const customTooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Institution Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track and analyze overall academic performance.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Filter:</label>
          <select 
            value={semester} 
            onChange={(e) => setSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="input-field py-1.5 w-32"
          >
            <option value="all">All Semesters</option>
            {stats.semesters_available.map(sem => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
        <StatCard title="Total Students" value={stats.total_students} icon={Users} color="bg-indigo-100 text-indigo-600" darkColor="dark:bg-indigo-900/50 dark:text-indigo-400" />
        <StatCard title="Subjects Taught" value={stats.total_subjects} icon={BookOpen} color="bg-blue-100 text-blue-600" darkColor="dark:bg-blue-900/50 dark:text-blue-400" />
        <StatCard title="Results Processed" value={stats.total_results} icon={FileCheck} color="bg-emerald-100 text-emerald-600" darkColor="dark:bg-emerald-900/50 dark:text-emerald-400" />
        <StatCard title="Overall Pass Rate" value={`${stats.overall_pass_percentage}%`} icon={Target} color="bg-purple-100 text-purple-600" darkColor="dark:bg-purple-900/50 dark:text-purple-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        
        {/* Grade Distribution */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {grade_distribution.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={grade_distribution}
                      dataKey="count"
                      nameKey="grade"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                    >
                      {grade_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={customTooltipStyle} itemStyle={{ color: isDark ? '#fff' : '#000' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">No grades data</div>
            )}
          </CardContent>
        </Card>

        {/* Subject Performance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subject Performance (Pass %)</CardTitle>
          </CardHeader>
          <CardContent>
            {subject_performance.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subject_performance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="subject_code" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} domain={[0, 100]} />
                    <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: isDark ? '#334155' : '#f1f5f9' }} />
                    <Bar dataKey="pass_percentage" name="Pass Rate %" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">No subject data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performers Table */}
      <Card className="animate-slide-up overflow-hidden" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <CardTitle>Top Performing Students</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {top_performers.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Register No.</th>
                  <th className="px-6 py-4 font-medium">Student Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {top_performers.map((student, i) => (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">#{i + 1}</td>
                    <td className="px-6 py-4 font-mono">{student.register_number}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white capitalize">{student.student_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500">No students available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, darkColor }: any) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color} ${darkColor}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</h3>
      </div>
    </Card>
  );
}
