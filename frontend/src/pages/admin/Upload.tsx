import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, FileSpreadsheet, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { StatusMessage } from '../../components/ui/StatusMessage';
import api, { getApiErrorMessage, isRequestCanceled } from '../../lib/api';
import { UploadHistory, UploadResponse } from '../../types';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [history, setHistory] = useState<UploadHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const controller = new AbortController();
    fetchHistory(controller.signal);
    return () => controller.abort();
  }, [fetchHistory]);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

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

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Results</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload validated CSV or XLSX files containing student marks.
        </p>
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
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.xlsx"
                  className="hidden"
                />
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <Upload className="h-8 w-8 text-indigo-500" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                  Click or drag a file here to upload
                </h3>
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                  Only CSV and XLSX files up to 5 MB are accepted.
                </p>
                <div className="inline-block rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
                  Required columns: register_number, student_name, semester, subject_code, marks
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
                      <p className="max-w-[200px] truncate font-semibold text-slate-900 dark:text-white sm:max-w-[300px]">
                        {file.name}
                      </p>
                      <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  {!isUploading && !result ? (
                    <button
                      onClick={resetFile}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
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
                      {result.status === 'failed' ? (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      )}
                      Upload Summary
                    </h4>
                    <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <p className="mb-1 text-slate-500 dark:text-slate-400">Processed</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {result.records_processed}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <p className="mb-1 text-slate-500 dark:text-slate-400">Failed</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">
                          {result.records_failed}
                        </p>
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

      <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
          <CardTitle>Recent Uploads</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => fetchHistory()} disabled={isHistoryLoading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {historyError ? (
            <div className="p-6">
              <StatusMessage
                title="Upload history unavailable"
                message={historyError}
                variant="error"
                actionLabel="Retry"
                onAction={() => fetchHistory()}
              />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((batch) => (
                  <tr key={batch.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="flex items-center gap-2 px-6 py-4 text-slate-500">
                      <Clock className="h-4 w-4" />
                      {formatDistanceToNow(new Date(batch.uploaded_at), { addSuffix: true })}
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-4 font-medium text-slate-900 dark:text-white" title={batch.file_name}>
                      {batch.file_name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          batch.status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                      >
                        {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">
                      +{batch.records_processed}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-red-600">
                      {batch.records_failed > 0 ? `-${batch.records_failed}` : 0}
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
