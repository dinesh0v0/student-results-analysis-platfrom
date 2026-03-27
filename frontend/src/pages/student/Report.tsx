import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { AccountHeader } from './AccountHeader';
import { Download, FileText, Printer, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '../../lib/api';

export default function StudentReport() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    const downloadToast = toast.loading('Generating your PDF report...');
    
    try {
      const response = await api.get('/api/student/report/pdf', {
        responseType: 'blob',
      });
      
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Academic_Report_${new Date().getFullYear()}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully!', { id: downloadToast });
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Failed to generate PDF. Please try again.'),
        { id: downloadToast }
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <AccountHeader title="Official Reports" subtitle="Download verifiable academic transcripts and reports" />

      <div className="grid md:grid-cols-2 gap-6 animate-slide-up">
        
        {/* Main Transcript Download */}
        <Card className="border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-slate-900">
          <CardHeader>
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl">Consolidated Academic Transcript</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Get a comprehensive PDF report containing your entire academic history across all semesters, subject-wise marks, grades, and overall percentage metrics.
            </p>
            
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
               <li className="flex items-center gap-2">• Institution header and official branding</li>
               <li className="flex items-center gap-2">• Verifiable timestamp and records</li>
               <li className="flex items-center gap-2">• Semester-by-semester breakdown</li>
            </ul>

            <Button 
              className="w-full sm:w-auto" 
              size="lg" 
              onClick={handleDownloadPDF}
              isLoading={isDownloading}
            >
              <Download className="w-5 h-5" /> Download PDF Report
            </Button>
          </CardContent>
        </Card>

        {/* Other actions (Placeholders for future) */}
        <div className="space-y-4">
          <Card className="hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer group">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  <Printer className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">Print View</h4>
                  <p className="text-xs text-slate-500">Browser-friendly printable format</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" disabled>Coming Soon</Button>
            </CardContent>
          </Card>

          <Card className="hover:border-slate-300 dark:hover:border-slate-600 transition-colors cursor-pointer group">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  <Mail className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">Email to Parents/Guardian</h4>
                  <p className="text-xs text-slate-500">Send report via email automatically</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
