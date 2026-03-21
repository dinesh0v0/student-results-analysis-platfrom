import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Student, Result } from '../../types';
import { Search, UserCircle, BookOpen, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function StudentLookup() {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentResults, setStudentResults] = useState<Result[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Debounced search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchStudents(searchTerm);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchStudents = async (query: string) => {
    setIsLoadingList(true);
    try {
      const { data } = await api.get(`/api/admin/students${query ? `?search=${query}` : ''}`);
      setStudents(data);
    } catch (error) {
      toast.error('Failed to load student directory.');
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadStudentDetails = async (registerNo: string) => {
    setIsLoadingDetails(true);
    try {
      const { data } = await api.get(`/api/admin/students/${registerNo}`);
      setSelectedStudent(data.student);
      setStudentResults(data.results);
      // On mobile, scroll to details
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load student details.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Student Directory</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Search and view individual student academic records.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Panel: Search & Directory List */}
        <Card className="lg:col-span-1 flex flex-col min-h-0 border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-9 text-sm py-2 rounded-lg"
                placeholder="Search by name or reg no..."
              />
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-0 border-t border-slate-100 dark:border-slate-800">
            {isLoadingList ? (
              <LoadingSpinner size={32} />
            ) : students.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => loadStudentDetails(student.register_number)}
                    className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-3 ${
                      selectedStudent?.id === student.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                      <UserCircle className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate capitalize">{student.student_name}</h4>
                      <p className="text-xs font-mono text-slate-500 truncate">{student.register_number}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                <Users className="w-8 h-8 mb-2 opacity-50" />
                <p>No students found.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel: Student Profile & Results */}
        <Card className="lg:col-span-2 flex flex-col min-h-0 bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
          {isLoadingDetails ? (
            <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
          ) : selectedStudent ? (
            <>
              {/* Profile Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <UserCircle className="w-10 h-10" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">{selectedStudent.student_name}</h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 rounded">{selectedStudent.register_number}</span>
                    {selectedStudent.email && <span>{selectedStudent.email}</span>}
                    <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {studentResults.length} records found</span>
                  </div>
                </div>
              </div>

              {/* Results Grid */}
              <div className="flex-1 p-6 overflow-y-auto">
                {studentResults.length > 0 ? (
                  <div className="space-y-6">
                    {/* Group by semester */}
                    {Object.entries(
                      studentResults.reduce((acc, curr) => {
                        (acc[curr.semester] = acc[curr.semester] || []).push(curr);
                        return acc;
                      }, {} as Record<number, Result[]>)
                    ).map(([semester, results]) => (
                      <div key={semester} className="space-y-3">
                        <h4 className="font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">
                          Semester {semester}
                        </h4>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {results.map((r, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                              <div className="mb-2">
                                <span className="text-xs font-mono text-slate-500 block">{r.subject_code}</span>
                                <h5 className="font-medium text-slate-800 dark:text-slate-200 text-sm line-clamp-2">{r.subject_name}</h5>
                              </div>
                              <div className="flex items-end justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                  <span className="text-xs text-slate-500 block">Marks</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{r.marks_obtained !== null ? `${r.marks_obtained}/${r.max_marks}` : 'N/A'}</span>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                    r.pass_status ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  }`}>
                                    {r.grade || (r.pass_status ? 'PASS' : 'FAIL')}
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
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <AlertCircle className="w-12 h-12 mb-2 opacity-50" />
                    <p>No result records found for this student.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl">
              <Search className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-medium text-slate-500">Select a student from the directory</p>
              <p className="text-sm mt-1">Their full academic profile will appear here.</p>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

// Ensure the icon is imported for the empty state
import { Users } from 'lucide-react';
