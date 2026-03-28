import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Award, BookOpen, Filter, Search, Target, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FullPageLoader } from '../../components/ui/LoadingSpinner';
import { StatusMessage } from '../../components/ui/StatusMessage';
import api, { getApiErrorMessage, isRequestCanceled } from '../../lib/api';
import { Result } from '../../types';
import { AccountHeader } from './AccountHeader';

interface LatestResultsResponse {
  semester: number | null;
  results: Result[];
}

type MarksRange = 'all' | 'gt90' | '75to89' | '50to74' | 'lt50';
type ResultStatus = 'all' | 'pass' | 'fail';

function getMarksRange(value: number | undefined, maxMarks: number) {
  if (value === undefined || maxMarks <= 0) {
    return 'lt50';
  }
  const percentage = (value / maxMarks) * 100;
  if (percentage > 90) {
    return 'gt90';
  }
  if (percentage >= 75) {
    return '75to89';
  }
  if (percentage >= 50) {
    return '50to74';
  }
  return 'lt50';
}

export default function StudentDashboard() {
  const [results, setResults] = useState<Result[]>([]);
  const [semester, setSemester] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [marksRange, setMarksRange] = useState<MarksRange>('all');
  const [resultStatus, setResultStatus] = useState<ResultStatus>('all');

  useEffect(() => {
    const controller = new AbortController();

    const fetchLatestResults = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const { data } = await api.get<LatestResultsResponse>('/api/student/results/latest', {
          signal: controller.signal,
        });
        setResults(data.results || []);
        setSemester(data.semester);
        setSelectedSemester(data.semester ? String(data.semester) : 'all');
      } catch (error) {
        if (isRequestCanceled(error)) {
          return;
        }

        setErrorMessage(getApiErrorMessage(error, 'Unable to load your current results.'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestResults();
    return () => controller.abort();
  }, [retryToken]);

  const semesterOptions = useMemo(
    () => ['all', ...Array.from(new Set(results.map((result) => String(result.semester)))).sort((a, b) => Number(a) - Number(b))],
    [results]
  );

  const filteredResults = useMemo(() => {
    const searchValue = subjectSearch.trim().toLowerCase();

    return results.filter((result) => {
      if (selectedSemester !== 'all' && String(result.semester) !== selectedSemester) {
        return false;
      }

      if (searchValue) {
        const haystack = `${result.subject_code} ${result.subject_name}`.toLowerCase();
        if (!haystack.includes(searchValue)) {
          return false;
        }
      }

      if (marksRange !== 'all' && getMarksRange(result.marks_obtained, result.max_marks) !== marksRange) {
        return false;
      }

      if (resultStatus === 'pass' && !result.pass_status) {
        return false;
      }

      if (resultStatus === 'fail' && result.pass_status) {
        return false;
      }

      return true;
    });
  }, [results, selectedSemester, subjectSearch, marksRange, resultStatus]);

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (errorMessage) {
    return (
      <div className="space-y-6 animate-fade-in">
        <AccountHeader title="Current Results" subtitle="Overview" />
        <StatusMessage
          title="Results unavailable"
          message={errorMessage}
          variant="error"
          actionLabel="Retry"
          onAction={() => setRetryToken((value) => value + 1)}
        />
      </div>
    );
  }

  const totalSubjects = results.length;
  const passedSubjects = results.filter((result) => result.pass_status).length;
  const isAllPassed = totalSubjects > 0 && passedSubjects === totalSubjects;
  const totalMarksObtained = results.reduce((sum, result) => sum + (result.marks_obtained || 0), 0);
  const totalMaxMarks = results.reduce((sum, result) => sum + result.max_marks, 0);
  const percentage = totalMaxMarks > 0 ? ((totalMarksObtained / totalMaxMarks) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6 animate-fade-in">
      <AccountHeader title="Current Results" subtitle={semester ? `Semester ${semester} Performance` : 'Overview'} />

      {!semester || results.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <BookOpen className="mx-auto mb-4 h-16 w-16 opacity-20" />
          <h3 className="mb-1 text-xl font-medium text-slate-700 dark:text-slate-300">No Results Found</h3>
          <p>Your results for the current semester have not been uploaded yet.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 animate-slide-up sm:grid-cols-3">
            <Card className="flex items-center gap-4 border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 dark:border-indigo-800 dark:from-indigo-900/20 dark:to-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Semester {semester} GPA</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{percentage}%</h3>
              </div>
            </Card>

            <Card className={`flex items-center gap-4 border bg-gradient-to-br p-5 ${isAllPassed ? 'border-emerald-100 from-emerald-50 to-white dark:border-emerald-800 dark:from-emerald-900/20 dark:to-slate-900' : 'border-red-100 from-red-50 to-white dark:border-red-800 dark:from-red-900/20 dark:to-slate-900'}`}>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isAllPassed ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'}`}>
                {isAllPassed ? <Award className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</p>
                <h3 className={`mt-1 text-2xl font-bold ${isAllPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{isAllPassed ? 'ALL CLEARED' : 'ARREARS'}</h3>
              </div>
            </Card>

            <Card className="flex items-center gap-4 border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 dark:border-blue-800 dark:from-blue-900/20 dark:to-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Subjects Cleared</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {passedSubjects} <span className="text-base font-medium text-slate-400">/ {totalSubjects}</span>
                </h3>
              </div>
            </Card>
          </div>

          <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle>Subject-wise Breakdown</CardTitle>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:min-w-[720px]">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <Filter className="h-4 w-4" />
                    Quick Filters
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span>Semester</span>
                      <select className="input-field w-full py-2 text-sm normal-case" value={selectedSemester} onChange={(event) => setSelectedSemester(event.target.value)}>
                        {semesterOptions.map((option) => (
                          <option key={option} value={option}>
                            {option === 'all' ? 'All Semesters' : `Semester ${option}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span>Subject</span>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input className="input-field w-full py-2 pl-9 text-sm normal-case" value={subjectSearch} onChange={(event) => setSubjectSearch(event.target.value)} placeholder="Code or name" />
                      </div>
                    </label>

                    <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span>Marks Range</span>
                      <select className="input-field w-full py-2 text-sm normal-case" value={marksRange} onChange={(event) => setMarksRange(event.target.value as MarksRange)}>
                        <option value="all">All Scores</option>
                        <option value="gt90">Above 90%</option>
                        <option value="75to89">75% - 89%</option>
                        <option value="50to74">50% - 74%</option>
                        <option value="lt50">Below 50%</option>
                      </select>
                    </label>

                    <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span>Result Status</span>
                      <select className="input-field w-full py-2 text-sm normal-case" value={resultStatus} onChange={(event) => setResultStatus(event.target.value as ResultStatus)}>
                        <option value="all">All Results</option>
                        <option value="pass">Pass</option>
                        <option value="fail">Fail</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {filteredResults.length > 0 ? (
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="rounded-tl-lg px-6 py-4 font-medium">Code</th>
                      <th className="px-6 py-4 font-medium">Subject Name</th>
                      <th className="px-6 py-4 text-right font-medium">Marks</th>
                      <th className="px-6 py-4 text-center font-medium">Grade</th>
                      <th className="rounded-tr-lg px-6 py-4 text-center font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredResults.map((result) => (
                      <tr key={result.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-6 py-4 font-mono text-slate-500">{result.subject_code}</td>
                        <td className="max-w-[250px] truncate px-6 py-4 font-medium text-slate-900 dark:text-white" title={result.subject_name}>{result.subject_name}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-slate-900 dark:text-white">{result.marks_obtained ?? '-'}</span>
                          <span className="mx-1 text-slate-400">/</span>
                          <span className="text-slate-500">{result.max_marks}</span>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-300">{result.grade || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${result.pass_status ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {result.pass_status ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500">No subjects match the selected filters.</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
