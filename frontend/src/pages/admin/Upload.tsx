import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { StatusMessage } from '../../components/ui/StatusMessage';
import api, { getApiErrorMessage, isRequestCanceled } from '../../lib/api';
import { DashboardFilterOptions, HierarchyFilters, Result, UploadHistory, UploadResponse } from '../../types';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const HIERARCHY_FIELDS: Array<keyof HierarchyFilters> = ['campus', 'faculty', 'department', 'branch', 'section'];

function buildQueryString(filters: HierarchyFilters, semester: string, search: string) {
  const params = new URLSearchParams();
  if (semester !== 'all') {
    params.set('semester', semester);
  }
  if (search.trim()) {
    params.set('search', search.trim());
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

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [history, setHistory] = useState<UploadHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [isResultsLoading, setIsResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState('');
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilterOptions | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ marks_obtained: string; max_marks: string; grade: string }>({
    marks_obtained: '',
    max_marks: '100',
    grade: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const semester = searchParams.get('semester') ?? 'all';
  const search = searchParams.get('search') ?? '';
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

  const semesterOptions = useMemo(
    () => ['all', ...Array.from(new Set(results.map((row) => String(row.semester))))].sort((left, right) => {
      if (left === 'all') {
        return -1;
      }
      if (right === 'all') {
        return 1;
      }
      return Number(left) - Number(right);
    }),
    [results]
  );

  const updateSearchParams = (updates: Partial<HierarchyFilters> & { semester?: string; search?: string }) => {
    const next = new URLSearchParams(searchParams);
    if (Object.prototype.hasOwnProperty.call(updates, 'semester')) {
      if (!updates.semester || updates.semester === 'all') {
        next.delete('semester');
      } else {
        next.set('semester', updates.semester);
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'search')) {
      if (!updates.search || !updates.search.trim()) {
        next.delete('search');
      } else {
        next.set('search', updates.search.trim());
      }
    }

    HIERARCHY_FIELDS.forEach((field, index) => {
      if (!Object.prototype.hasOwnProperty.call(updates, field)) {
        return;
      }

      const value = updates[field];
      if (!value) {
        next.delete(field);
      } else {
        next.set(field, value);
      }

      HIERARCHY_FIELDS.slice(index + 1).forEach((childField) => next.delete(childField));
    });

    setSearchParams(next);
  };

  const fetchHistory = useCallback(async (signal?: AbortSignal) => {
    setIsHistoryLoading(true);
    setHistoryError('');

    try {
      const { data } = await api.get('/api/admin/upload-history', { signal });
      setHistory(data);
    } catch (error) {
      if (isRequestCanceled(error)) {
        return;
      }
      setHistoryError(getApiErrorMessage(error, 'Unable to load upload history.'));
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const fetchResults = useCallback(async (signal?: AbortSignal) => {
    setIsResultsLoading(true);
    setResultsError('');

    try {
      const query = buildQueryString(activeFilters, semester, search);
      const [{ data: dashboardData }, { data: resultData }] = await Promise.all([
        api.get(`/api/admin/dashboard${buildQueryString(activeFilters, semester, '')}`, { signal }),
        api.get(`/api/admin/results${query}`, { signal }),
      ]);
      setDashboardFilters(dashboardData.filters);
      setResults(resultData);
    } catch (error) {
      if (isRequestCanceled(error)) {
        return;
      }
      setResultsError(getApiErrorMessage(error, 'Unable to load result management data.'));
    } finally {
      setIsResultsLoading(false);
    }
  }, [activeFilters, search, semester]);

  useEffect(() => {
    const controller = new AbortController();
    fetchHistory(controller.signal);
    return () => controller.abort();
  }, [fetchHistory]);

  useEffect(() => {
    const controller = new AbortController();
    fetchResults(controller.signal);
    return () => controller.abort();
  }, [fetchResults]);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => setIsDragActive(false);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.files?.[0]) {
      handleFile(event.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      handleFile(event.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    const lowerName = selectedFile.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      toast.error('Invalid file type. Please upload a CSV or XLSX file.');
      return;
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      toast.error('File is too large. The maximum allowed size is 5 MB.');
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const resetFile = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async () => {
    if (!file) {
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/api/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(data);
      if (data.status === 'completed') {
        toast.success(`Successfully processed ${data.records_processed} records.`);
      } else {
        toast.error('Upload failed. Review the validation log for details.');
      }

      fetchHistory();
      fetchResults();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Upload failed due to a server error.');
      setResult({
        batch_id: '',
        records_processed: 0,
        records_failed: 0,
        errors: [message],
        status: 'failed',
      });
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const startEditing = (row: Result) => {
    setEditingResultId(row.id);
    setEditValues({
      marks_obtained: String(row.marks_obtained ?? ''),
      max_marks: String(row.max_marks ?? 100),
      grade: row.grade ?? '',
    });
  };

  const saveEdit = async (resultId: string) => {
    try {
      const payload = {
        marks_obtained: Number(editValues.marks_obtained),
        max_marks: Number(editValues.max_marks),
        grade: editValues.grade.trim() || undefined,
      };
      const { data } = await api.patch(`/api/admin/results/${resultId}`, payload);
      setResults((current) => current.map((row) => (row.id === resultId ? data : row)));
      setEditingResultId(null);
      toast.success('Result updated successfully.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update the result.'));
    }
  };

  const deleteResult = async (resultId: string) => {
    if (!window.confirm('Delete this result record permanently?')) {
      return;
    }
    try {
      await api.delete(`/api/admin/results/${resultId}`);
      setResults((current) => current.filter((row) => row.id !== resultId));
      toast.success('Result deleted successfully.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to delete the result.'));
    }
  };

  const deleteBatch = async (batchId: string) => {
    if (!window.confirm('Delete this upload batch and all linked imported result rows?')) {
      return;
    }
    try {
      const { data } = await api.delete(`/api/admin/upload-batches/${batchId}`);
      setHistory((current) => current.filter((batch) => batch.id !== batchId));
      setResults((current) => current.filter((row) => row.upload_batch_id !== batchId));
      toast.success(`Deleted batch and ${data.deleted_results} linked result rows.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to delete the upload batch.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload & Manage Results</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Upload new result files, edit marks inline, and remove stale batches or records.
          </p>
        </div>
        <Link to="/admin" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
          Back to hierarchy dashboard
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
                  isDragActive
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-indigo-500 dark:hover:bg-slate-800'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.xlsx" className="hidden" />
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <Upload className="h-8 w-8 text-indigo-500" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Click or drag a file here to upload</h3>
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Only CSV and XLSX files up to 5 MB are accepted.</p>
                <div className="inline-block rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
                  Accepted columns: campus, faculty, department, branch, section, register_number, student_name, semester, subject_codes, subject_names, marks, max_marks, grades
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-indigo-500 shadow-sm dark:bg-slate-900">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="max-w-[200px] truncate font-semibold text-slate-900 dark:text-white sm:max-w-[300px]">{file.name}</p>
                      <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  {!isUploading && !result ? (
                    <button onClick={resetFile} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                      <X className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>

                {!result ? (
                  <Button onClick={uploadFile} className="w-full" isLoading={isUploading} disabled={isUploading}>
                    Start Processing File
                  </Button>
                ) : (
                  <div className="mt-4 animate-fade-in border-t border-slate-200 pt-4 dark:border-slate-700">
                    <h4 className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                      {result.status === 'failed' ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <CheckCircle className="h-5 w-5 text-emerald-500" />}
                      Upload Summary
                    </h4>
                    <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <p className="mb-1 text-slate-500 dark:text-slate-400">Processed</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.records_processed}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <p className="mb-1 text-slate-500 dark:text-slate-400">Failed</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{result.records_failed}</p>
                      </div>
                    </div>
                    <Button onClick={resetFile} variant="outline" className="w-full">
                      Upload Another File
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <CardTitle>Processing Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              result.errors && result.errors.length > 0 ? (
                <div className="h-[300px] space-y-2 overflow-y-auto rounded-xl border border-red-100 bg-red-50 p-4 font-mono text-xs text-red-800 dark:border-red-900 dark:bg-red-900/10 dark:text-red-300">
                  {result.errors.map((error, index) => (
                    <div key={`${error}-${index}`} className="border-b border-red-200/50 pb-2 last:border-0 dark:border-red-800/50">
                      {error}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-[300px] flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-900/10 dark:text-emerald-400">
                  <CheckCircle className="mb-2 h-12 w-12 opacity-80" />
                  <p className="font-medium">All records processed successfully.</p>
                  <p className="mt-1 text-sm opacity-80">Found 0 errors.</p>
                </div>
              )
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400 dark:border-slate-700">
                Upload a file to see validation logs.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <CardHeader>
          <CardTitle>Result Management Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            <FilterSelect label="Semester" value={semester} options={[]} allLabel="All Semesters" onChange={(value) => updateSearchParams({ semester: value })} manualOptions={semesterOptions} />
            <FilterSelect label="Campus" value={activeFilters.campus ?? 'all'} options={dashboardFilters?.campus_options ?? []} allLabel="All Campuses" onChange={(value) => updateSearchParams({ campus: value === 'all' ? null : value })} />
            <FilterSelect label="Faculty" value={activeFilters.faculty ?? 'all'} options={dashboardFilters?.faculty_options ?? []} allLabel="All Faculties" onChange={(value) => updateSearchParams({ faculty: value === 'all' ? null : value })} />
            <FilterSelect label="Department" value={activeFilters.department ?? 'all'} options={dashboardFilters?.department_options ?? []} allLabel="All Departments" onChange={(value) => updateSearchParams({ department: value === 'all' ? null : value })} />
            <FilterSelect label="Branch" value={activeFilters.branch ?? 'all'} options={dashboardFilters?.branch_options ?? []} allLabel="All Branches" onChange={(value) => updateSearchParams({ branch: value === 'all' ? null : value })} />
            <FilterSelect label="Section" value={activeFilters.section ?? 'all'} options={dashboardFilters?.section_options ?? []} allLabel="All Sections" onChange={(value) => updateSearchParams({ section: value === 'all' ? null : value })} />
            <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>Search</span>
              <input
                className="input-field w-full py-2 text-sm normal-case"
                value={search}
                onChange={(event) => updateSearchParams({ search: event.target.value })}
                placeholder="Register no / student / subject"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
          <CardTitle>Manage Imported Results</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {resultsError ? (
            <div className="p-6">
              <StatusMessage title="Results unavailable" message={resultsError} variant="error" actionLabel="Retry" onAction={() => fetchResults()} />
            </div>
          ) : isResultsLoading ? (
            <div className="p-8 text-center text-slate-500">Loading results...</div>
          ) : results.length > 0 ? (
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Hierarchy</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Marks</th>
                  <th className="px-4 py-3 font-medium">Grade</th>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.map((row) => {
                  const isEditing = editingResultId === row.id;
                  return (
                    <tr key={row.id} className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{row.student_name || 'Unknown Student'}</div>
                        <div className="font-mono text-xs text-slate-500">{row.register_number || 'N/A'} | Sem {row.semester}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {[row.campus, row.faculty, row.department, row.branch, row.section].filter(Boolean).join(' / ') || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{row.subject_code}</div>
                        <div className="text-xs text-slate-500">{row.subject_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input className="input-field w-24 py-1.5 text-sm" value={editValues.marks_obtained} onChange={(event) => setEditValues((current) => ({ ...current, marks_obtained: event.target.value }))} />
                            <span>/</span>
                            <input className="input-field w-24 py-1.5 text-sm" value={editValues.max_marks} onChange={(event) => setEditValues((current) => ({ ...current, max_marks: event.target.value }))} />
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-900 dark:text-white">{row.marks_obtained ?? '-'} / {row.max_marks}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input className="input-field w-24 py-1.5 text-sm" value={editValues.grade} onChange={(event) => setEditValues((current) => ({ ...current, grade: event.target.value.toUpperCase() }))} />
                        ) : (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.pass_status ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{row.grade || (row.pass_status ? 'PASS' : 'FAIL')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{row.file_name || 'Manual/legacy'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={() => saveEdit(row.id)}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingResultId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEditing(row)}>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => deleteResult(row.id)}>
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500">No result rows found for the selected filters.</div>
          )}
        </CardContent>
      </Card>

      <Card className="animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
          <CardTitle>Recent Uploads</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => fetchHistory()} disabled={isHistoryLoading}>Refresh</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {historyError ? (
            <div className="p-6">
              <StatusMessage title="Upload history unavailable" message={historyError} variant="error" actionLabel="Retry" onAction={() => fetchHistory()} />
            </div>
          ) : isHistoryLoading ? (
            <div className="p-8 text-center text-slate-500">Loading upload history...</div>
          ) : history.length > 0 ? (
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Filename</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 text-right font-medium">Processed</th>
                  <th className="px-6 py-4 text-right font-medium">Failed</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((batch) => (
                  <tr key={batch.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 text-slate-500">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatDistanceToNow(new Date(batch.uploaded_at), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-4 font-medium text-slate-900 dark:text-white" title={batch.file_name}>{batch.file_name}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${batch.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400'}`}>{batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">+{batch.records_processed}</td>
                    <td className="px-6 py-4 text-right font-medium text-red-600">{batch.records_failed > 0 ? `-${batch.records_failed}` : 0}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="danger" onClick={() => deleteBatch(batch.id)}>
                        <Trash2 className="h-4 w-4" />
                        Delete Batch
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500">No upload history available.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
  manualOptions?: string[];
}

function FilterSelect({ label, value, options, allLabel, onChange, manualOptions }: FilterSelectProps) {
  const values = manualOptions ?? ['all', ...options];
  return (
    <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input-field w-full py-2 text-sm normal-case">
        {values.map((option, index) => (
          <option key={`${label}-${option}-${index}`} value={option}>
            {option === 'all' ? allLabel : option}
          </option>
        ))}
      </select>
    </label>
  );
}
