import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { UploadHistory, UploadResponse } from '../../types';
import { formatDistanceToNow } from 'date-fns';

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [history, setHistory] = useState<UploadHistory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/api/admin/upload-history');
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history');
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    const validTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
      toast.error('Invalid file type. Please upload CSV or Excel files.');
      return;
    }
    setFile(selectedFile);
    setResult(null); // Clear previous result
  };

  const resetFile = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async () => {
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const { data } = await api.post('/api/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setResult(data);
      if (data.status === 'completed' && data.records_failed === 0) {
        toast.success(`Successfully processed ${data.records_processed} records!`);
      } else if (data.status === 'failed') {
        toast.error('Upload failed. Check the error log.');
      } else {
        toast.success(`Processed ${data.records_processed} records, but ${data.records_failed} failed.`);
      }
      
      fetchHistory(); // Refresh history table
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Upload failed due to server error.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Results</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Upload CSV or XLSX files containing student marks.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* Upload Zone */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle>File Upload</CardTitle>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div 
                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                  isDragActive 
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                    : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                  accept=".csv, .xlsx, .xls" 
                  className="hidden" 
                />
                <div className="mx-auto w-16 h-16 mb-4 bg-white dark:bg-slate-900 rounded-full shadow-sm flex items-center justify-center border border-slate-100 dark:border-slate-800">
                  <Upload className="w-8 h-8 text-indigo-500" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Click or drag file to this area to upload
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Support for a single or bulk upload. Strictly CSV or XLSX files.
                </p>
                <div className="text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg inline-block border border-slate-100 dark:border-slate-800">
                  Required columns: register_number, student_name, semester, subject_code, marks
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-6 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl shadow-sm flex items-center justify-center text-indigo-500">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[300px]">{file.name}</p>
                      <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  {!isUploading && !result && (
                    <button onClick={resetFile} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                
                {!result && (
                  <Button 
                    onClick={uploadFile} 
                    className="w-full" 
                    isLoading={isUploading}
                    disabled={isUploading}
                  >
                    Start Processing File
                  </Button>
                )}

                {/* Processing Results Summary */}
                {result && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-fade-in">
                    <h4 className="font-medium mb-3 text-slate-900 dark:text-white flex items-center gap-2">
                      {result.status === 'failed' ? <AlertTriangle className="text-red-500 w-5 h-5"/> : <CheckCircle className="text-emerald-500 w-5 h-5"/>}
                      Upload Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-500 dark:text-slate-400 mb-1">Processed</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{result.records_processed}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <p className="text-slate-500 dark:text-slate-400 mb-1">Failed</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{result.records_failed}</p>
                      </div>
                    </div>
                    <Button onClick={resetFile} variant="outline" className="w-full">Upload Another File</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Logs */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <CardTitle>Processing Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              result.errors && result.errors.length > 0 ? (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-xl p-4 h-[300px] overflow-y-auto font-mono text-xs text-red-800 dark:text-red-300 space-y-2">
                  {result.errors.map((err, idx) => (
                    <div key={idx} className="pb-2 border-b border-red-200/50 dark:border-red-800/50 last:border-0">{err}</div>
                  ))}
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900 rounded-xl">
                  <CheckCircle className="w-12 h-12 mb-2 opacity-80" />
                  <p className="font-medium">All records processed successfully!</p>
                  <p className="text-sm opacity-80 mt-1">Found 0 errors.</p>
                </div>
              )
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                Upload a file to see validation logs
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Upload History Table */}
      <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <CardTitle>Recent Uploads</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchHistory}>Refresh</Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {history.length > 0 ? (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Filename</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Processed</th>
                  <th className="px-6 py-4 font-medium text-right">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 flex items-center gap-2">
                       <Clock className="w-4 h-4" /> {formatDistanceToNow(new Date(batch.uploaded_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title={batch.file_name}>
                      {batch.file_name}
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          batch.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' : 
                          batch.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' :
                          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
                       }`}>
                         {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right text-emerald-600 font-medium">+{batch.records_processed}</td>
                    <td className="px-6 py-4 text-right text-red-600 font-medium">{batch.records_failed > 0 ? `-${batch.records_failed}` : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-500">No upload history available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
