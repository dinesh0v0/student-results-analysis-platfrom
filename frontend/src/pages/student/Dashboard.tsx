import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FullPageLoader } from '../../components/ui/LoadingSpinner';
import { AccountHeader } from './AccountHeader'; // We'll create a shared header component
import { Result } from '../../types';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { BookOpen, AlertCircle, Award, Target, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [results, setResults] = useState<Result[]>([]);
  const [semester, setSemester] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestResults = async () => {
      try {
        const { data } = await api.get('/api/student/results/latest');
        setResults(data.results);
        setSemester(data.semester);
      } catch (error: any) {
        if (error.response?.status !== 404) {
          toast.error('Failed to load results.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchLatestResults();
  }, []);

  if (isLoading) return <FullPageLoader />;

  // Computed metrics for the latest semester
  const totalSubjects = results.length;
  const passedSubjects = results.filter(r => r.pass_status).length;
  const isAllPassed = totalSubjects > 0 && passedSubjects === totalSubjects;
  const totalMarksObtained = results.reduce((sum, r) => sum + (r.marks_obtained || 0), 0);
  const totalMaxMarks = results.reduce((sum, r) => sum + r.max_marks, 0);
  const percentage = totalMaxMarks > 0 ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(2) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      
      <AccountHeader title="Current Results" subtitle={semester ? `Semester ${semester} Performance` : 'Overview'} />

      {!semester || results.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-700 dark:text-slate-300 mb-1">No Results Found</h3>
          <p>Your results for the current semester have not been uploaded yet.</p>
        </Card>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-slide-up">
             <Card className="flex items-center gap-4 p-5 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 border-indigo-100 dark:border-indigo-800">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Semester {semester} GPA</p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {/* Placeholder for GPA calculation if applicable, using percentage for now */}
                    {percentage}%
                  </h3>
                </div>
              </Card>

              <Card className={`flex items-center gap-4 p-5 bg-gradient-to-br border ${isAllPassed ? 'from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 border-emerald-100 dark:border-emerald-800' : 'from-red-50 to-white dark:from-red-900/20 dark:to-slate-900 border-red-100 dark:border-red-800'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAllPassed ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'}`}>
                  {isAllPassed ? <Award className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</p>
                  <h3 className={`text-2xl font-bold mt-1 ${isAllPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isAllPassed ? 'ALL CLEA瑞D' : 'ARREARS'}
                  </h3>
                </div>
              </Card>

              <Card className="flex items-center gap-4 p-5 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900 border-blue-100 dark:border-blue-800">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Subjects Cleared</p>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {passedSubjects} <span className="text-slate-400 text-base font-medium">/ {totalSubjects}</span>
                  </h3>
                </div>
              </Card>
          </div>

          {/* Results Table */}
          <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Subject-wise Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-medium rounded-tl-lg">Code</th>
                    <th className="px-6 py-4 font-medium">Subject Name</th>
                    <th className="px-6 py-4 font-medium text-right">Marks</th>
                    <th className="px-6 py-4 font-medium text-center">Grade</th>
                    <th className="px-6 py-4 font-medium text-center rounded-tr-lg">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-500">{r.subject_code}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white max-w-[250px] truncate" title={r.subject_name}>
                        {r.subject_name}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className="font-bold text-slate-900 dark:text-white">{r.marks_obtained ?? '-'}</span>
                         <span className="text-slate-400 mx-1">/</span>
                         <span className="text-slate-500">{r.max_marks}</span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-300">
                        {r.grade || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                           r.pass_status ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {r.pass_status ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
