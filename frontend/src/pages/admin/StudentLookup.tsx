import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, Search, UserCircle, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { StatusMessage } from '../../components/ui/StatusMessage';
import api, { getApiErrorMessage, isRequestCanceled } from '../../lib/api';
import { Result, Student } from '../../types';

export default function StudentLookup() {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentResults, setStudentResults] = useState<Result[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [listError, setListError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [listRetryToken, setListRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingList(true);
      setListError('');

      try {
        const query = searchTerm.trim();
        const { data } = await api.get(`/api/admin/students${query ? `?search=${encodeURIComponent(query)}` : ''}`, {
          signal: controller.signal,
        });
        setStudents(data);
      } catch (error) {
        if (isRequestCanceled(error)) {
          return;
        }

        setListError(getApiErrorMessage(error, 'Unable to load the student directory.'));
      } finally {
        setIsLoadingList(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm, listRetryToken]);

  const loadStudentDetails = async (registerNumber: string) => {
    setIsLoadingDetails(true);
    setDetailsError('');

    try {
      const { data } = await api.get(`/api/admin/students/${encodeURIComponent(registerNumber)}`);
      setSelectedStudent(data.student);
      setStudentResults(data.results);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to load the student profile.');
      setDetailsError(message);
      toast.error(message);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Directory</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Search and view individual student academic records.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-3">
        <Card className="flex min-h-0 flex-col border-slate-200 dark:border-slate-800 lg:col-span-1">
          <CardHeader className="pb-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-field rounded-lg py-2 pl-9 text-sm"
                placeholder="Search by name or reg no..."
              />
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto border-t border-slate-100 p-0 dark:border-slate-800">
            {listError ? (
              <div className="p-4">
                <StatusMessage
                  title="Directory unavailable"
                  message={listError}
                  variant="error"
                  actionLabel="Retry"
                  onAction={() => setListRetryToken((value) => value + 1)}
                />
              </div>
            ) : isLoadingList ? (
              <LoadingSpinner size={32} />
            ) : students.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => loadStudentDetails(student.register_number)}
                    className={`flex w-full items-center gap-3 border-l-4 p-4 text-left transition-colors ${
                      selectedStudent?.id === student.id
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                      <UserCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold capitalize text-slate-900 dark:text-white">
                        {student.student_name}
                      </h4>
                      <p className="truncate font-mono text-xs text-slate-500">{student.register_number}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center p-8 text-center text-slate-500">
                <Users className="mb-2 h-8 w-8 opacity-50" />
                <p>No students found.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col border-slate-200 bg-white/50 dark:border-slate-800 dark:bg-slate-900/50 lg:col-span-2">
          {isLoadingDetails ? (
            <div className="flex flex-1 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : detailsError ? (
            <div className="p-6">
              <StatusMessage
                title="Student details unavailable"
                message={detailsError}
                variant="error"
                actionLabel={selectedStudent ? 'Reload Student' : undefined}
                onAction={selectedStudent ? () => loadStudentDetails(selectedStudent.register_number) : undefined}
              />
            </div>
          ) : selectedStudent ? (
            <>
              <div className="flex flex-col items-start gap-4 rounded-t-2xl border-b border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                  <UserCircle className="h-10 w-10" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold capitalize text-slate-900 dark:text-white">
                    {selectedStudent.student_name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <span className="rounded bg-slate-100 px-2 font-mono dark:bg-slate-800">
                      {selectedStudent.register_number}
                    </span>
                    {selectedStudent.email ? <span>{selectedStudent.email}</span> : null}
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {studentResults.length} records found
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {studentResults.length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(
                      studentResults.reduce((accumulator, current) => {
                        (accumulator[current.semester] = accumulator[current.semester] || []).push(current);
                        return accumulator;
                      }, {} as Record<number, Result[]>)
                    ).map(([semester, results]) => (
                      <div key={semester} className="space-y-3">
                        <h4 className="border-b border-slate-100 pb-2 font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
                          Semester {semester}
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {results.map((result) => (
                            <div key={result.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                              <div className="mb-2">
                                <span className="block text-xs font-mono text-slate-500">{result.subject_code}</span>
                                <h5 className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {result.subject_name}
                                </h5>
                              </div>
                              <div className="mt-2 flex items-end justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
                                <div>
                                  <span className="block text-xs text-slate-500">Marks</span>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {result.marks_obtained !== null ? `${result.marks_obtained}/${result.max_marks}` : 'N/A'}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span
                                    className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                                      result.pass_status
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}
                                  >
                                    {result.grade || (result.pass_status ? 'PASS' : 'FAIL')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-400">
                    <AlertCircle className="mb-2 h-12 w-12 opacity-50" />
                    <p>No result records found for this student.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-slate-50/50 text-slate-400 dark:bg-slate-900/50">
              <Search className="mb-4 h-16 w-16 opacity-20" />
              <p className="font-medium text-slate-500">Select a student from the directory</p>
              <p className="mt-1 text-sm">Their full academic profile will appear here.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
