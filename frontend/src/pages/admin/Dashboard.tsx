import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookOpen, FileCheck, Target, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FullPageLoader } from '../../components/ui/LoadingSpinner';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { useTheme } from '../../contexts/ThemeContext';
import api, { getApiErrorMessage, isRequestCanceled } from '../../lib/api';
import { DashboardResponse, HierarchyFilters } from '../../types';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];
const HIERARCHY_FIELDS: Array<keyof HierarchyFilters> = [
  'campus',
  'faculty',
  'department',
  'branch',
  'section',
];

function buildQueryString(filters: HierarchyFilters, semester: number | 'all') {
  const params = new URLSearchParams();
  if (semester !== 'all') {
    params.set('semester', String(semester));
  }

  HIERARCHY_FIELDS.forEach((field) => {
    const value = filters[field];
    if (value) {
      params.set(field, value);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark } = useTheme();

  const semester = searchParams.get('semester') ? Number(searchParams.get('semester')) : 'all';
  const activeFilters = useMemo<HierarchyFilters>(
    () => ({
      campus: searchParams.get('campus'),
      faculty: searchParams.get('faculty'),
      department: searchParams.get('department'),
      branch: searchParams.get('branch'),
      section: searchParams.get('section'),
    }),
    [searchParams]
  );

  useEffect(() => {
    const controller = new AbortController();

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await api.get(`/api/admin/dashboard${buildQueryString(activeFilters, semester)}`, {
          signal: controller.signal,
        });
        setData(response.data);
      } catch (error) {
        if (isRequestCanceled(error)) {
          return;
        }

        setErrorMessage(getApiErrorMessage(error, 'Unable to load dashboard data right now.'));
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
    return () => controller.abort();
  }, [activeFilters, semester, retryToken]);

  const updateFilters = (updates: Partial<HierarchyFilters> & { semester?: number | 'all' }) => {
    const nextParams = new URLSearchParams(searchParams);

    if (Object.prototype.hasOwnProperty.call(updates, 'semester')) {
      const nextSemester = updates.semester;
      if (!nextSemester || nextSemester === 'all') {
        nextParams.delete('semester');
      } else {
        nextParams.set('semester', String(nextSemester));
      }
    }

    HIERARCHY_FIELDS.forEach((field, index) => {
      if (!Object.prototype.hasOwnProperty.call(updates, field)) {
        return;
      }

      const value = updates[field];
      if (!value) {
        nextParams.delete(field);
      } else {
        nextParams.set(field, value);
      }

      HIERARCHY_FIELDS.slice(index + 1).forEach((childField) => nextParams.delete(childField));
    });

    setSearchParams(nextParams);
  };

  if (isLoading && !data) {
    return <FullPageLoader />;
  }

  if (errorMessage && !data) {
    return (
      <StatusMessage
        title="Dashboard unavailable"
        message={errorMessage}
        variant="error"
        actionLabel="Retry"
        onAction={() => setRetryToken((value) => value + 1)}
      />
    );
  }

  if (!data) {
    return (
      <StatusMessage
        title="No data available"
        message="Upload validated results to populate the institution dashboard."
        actionLabel="Retry"
        onAction={() => setRetryToken((value) => value + 1)}
      />
    );
  }

  const { stats, grade_distribution, subject_performance, top_performers, filters, section_overview } = data;
  const customTooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
    color: isDark ? '#f8fafc' : '#0f172a',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  };

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <StatusMessage
          title="Showing cached dashboard data"
          message={errorMessage}
          variant="error"
          actionLabel="Retry"
          onAction={() => setRetryToken((value) => value + 1)}
        />
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Institution Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Drill down by campus, faculty, department, branch, and section.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:min-w-[780px]">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <FilterSelect
              label="Semester"
              value={semester}
              options={stats.semesters_available.map((value) => String(value))}
              allLabel="All Semesters"
              onChange={(value) => updateFilters({ semester: value === 'all' ? 'all' : Number(value) })}
            />
            <FilterSelect
              label="Campus"
              value={filters.campus ?? 'all'}
              options={filters.campus_options}
              allLabel="All Campuses"
              onChange={(value) => updateFilters({ campus: value === 'all' ? null : value })}
            />
            <FilterSelect
              label="Faculty"
              value={filters.faculty ?? 'all'}
              options={filters.faculty_options}
              allLabel="All Faculties"
              onChange={(value) => updateFilters({ faculty: value === 'all' ? null : value })}
            />
            <FilterSelect
              label="Department"
              value={filters.department ?? 'all'}
              options={filters.department_options}
              allLabel="All Departments"
              onChange={(value) => updateFilters({ department: value === 'all' ? null : value })}
            />
            <FilterSelect
              label="Branch"
              value={filters.branch ?? 'all'}
              options={filters.branch_options}
              allLabel="All Branches"
              onChange={(value) => updateFilters({ branch: value === 'all' ? null : value })}
            />
            <FilterSelect
              label="Section"
              value={filters.section ?? 'all'}
              options={filters.section_options}
              allLabel="All Sections"
              onChange={(value) => updateFilters({ section: value === 'all' ? null : value })}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Current scope: {stats.active_scope_label}</span>
            <button
              className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 animate-slide-up sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Scoped Students" value={stats.total_students} icon={Users} color="bg-indigo-100 text-indigo-600" darkColor="dark:bg-indigo-900/50 dark:text-indigo-400" />
        <StatCard title="Subjects Taught" value={stats.total_subjects} icon={BookOpen} color="bg-blue-100 text-blue-600" darkColor="dark:bg-blue-900/50 dark:text-blue-400" />
        <StatCard title="Results In Scope" value={stats.total_results} icon={FileCheck} color="bg-emerald-100 text-emerald-600" darkColor="dark:bg-emerald-900/50 dark:text-emerald-400" />
        <StatCard title="Pass Rate" value={`${stats.overall_pass_percentage}%`} icon={Target} color="bg-purple-100 text-purple-600" darkColor="dark:bg-purple-900/50 dark:text-purple-400" />
      </div>

      <Card className="animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <CardHeader>
          <CardTitle>Section Drilldown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {section_overview.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Campus</th>
                  <th className="px-4 py-3 font-medium">Faculty</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Branch</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 text-right font-medium">Results</th>
                  <th className="px-4 py-3 text-right font-medium">Pass %</th>
                  <th className="px-4 py-3 text-right font-medium">Average</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {section_overview.map((row, index) => {
                  const scopedLink = `/admin/upload${buildQueryString(
                    {
                      campus: row.campus,
                      faculty: row.faculty,
                      department: row.department,
                      branch: row.branch,
                      section: row.section,
                    },
                    semester
                  )}`;

                  return (
                    <tr key={`${row.campus}-${row.faculty}-${row.department}-${row.branch}-${row.section}-${index}`}>
                      <td className="px-4 py-3">{row.campus || 'Unassigned'}</td>
                      <td className="px-4 py-3">{row.faculty || 'Unassigned'}</td>
                      <td className="px-4 py-3">{row.department || 'Unassigned'}</td>
                      <td className="px-4 py-3">{row.branch || 'Unassigned'}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.section || 'Unassigned'}</td>
                      <td className="px-4 py-3 text-right">{row.total_results}</td>
                      <td className="px-4 py-3 text-right">{row.pass_percentage}%</td>
                      <td className="px-4 py-3 text-right">{row.average_marks}</td>
                      <td className="px-4 py-3 text-right">
                        <Link className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400" to={scopedLink}>
                          Manage results
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500">No section-level results found for the selected scope.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 animate-slide-up lg:grid-cols-3" style={{ animationDelay: '0.1s' }}>
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
                        <Cell key={`${entry.grade}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={customTooltipStyle} itemStyle={{ color: isDark ? '#fff' : '#000' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-slate-400">No grades data</div>
            )}
          </CardContent>
        </Card>

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
              <div className="flex h-64 items-center justify-center text-slate-400">No subject data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
          <CardTitle>Top Performing Students</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {top_performers.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Rank</th>
                  <th className="px-6 py-4 font-medium">Register No.</th>
                  <th className="px-6 py-4 font-medium">Student Name</th>
                  <th className="px-6 py-4 font-medium">Section</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {top_performers.map((student, index) => (
                  <tr key={student.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">#{index + 1}</td>
                    <td className="px-6 py-4 font-mono">{student.register_number}</td>
                    <td className="px-6 py-4 font-medium capitalize text-slate-900 dark:text-white">{student.student_name}</td>
                    <td className="px-6 py-4 text-slate-500">{student.section || 'Unassigned'}</td>
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

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  darkColor: string;
}

interface FilterSelectProps {
  label: string;
  value: string | number | 'all';
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
}

function StatCard({ title, value, icon: Icon, color, darkColor }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color} ${darkColor}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
      </div>
    </Card>
  );
}

function FilterSelect({ label, value, options, allLabel, onChange }: FilterSelectProps) {
  return (
    <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
      <span>{label}</span>
      <select
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        className="input-field w-full py-2 text-sm normal-case"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
