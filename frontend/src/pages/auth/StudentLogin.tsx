import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { UserCircle, Building, BadgeIcon as IdCard, Lock, Mail, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Institution } from '../../types';

type Step = 'verify' | 'register' | 'login';

export default function StudentLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [step, setStep] = useState<Step>('login');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form States
  const [institutionId, setInstitutionId] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');

  // Fetch institutions on mount
  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const { data } = await api.get('/api/auth/institutions');
        setInstitutions(data);
        if (data.length > 0) setInstitutionId(data[0].id);
      } catch (error) {
        toast.error('Failed to load institutions');
      }
    };
    fetchInstitutions();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionId || !registerNumber) return;
    
    setIsLoading(true);
    try {
      const { data } = await api.post('/api/auth/student/verify', {
        institution_id: institutionId,
        register_number: registerNumber,
      });
      
      setStudentName(data.student_name);
      setStep('register');
      toast.success('Roll number verified! Please create your account.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Verification failed. Please check your details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setIsLoading(true);
    try {
      const { data } = await api.post('/api/auth/student/register', {
        institution_id: institutionId,
        register_number: registerNumber,
        email,
        password,
      });
      
      handleLoginSuccess(data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await api.post('/api/auth/student/login', {
        email,
        password,
      });
      handleLoginSuccess(data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (data: any) => {
    login(data.access_token, {
      id: data.user_id,
      email: data.email,
      role: data.role,
      institution_id: data.institution_id,
      student_id: data.student_id,
    });
    toast.success('Welcome to ResultSphere!');
    navigate('/student');
  };

  const resetToVerify = () => {
    setStep('verify');
    setPassword('');
    setEmail('');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-slide-up glass-panel">
        
        {/* Toggle between Register flow and Login flow */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${step === 'login' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            onClick={() => setStep('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${(step === 'verify' || step === 'register') ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            onClick={() => setStep('verify')}
          >
            First Time? Register
          </button>
        </div>

        <CardHeader className="text-center space-y-2 pt-0">
          <div className="mx-auto bg-indigo-100 dark:bg-indigo-900/50 w-12 h-12 rounded-full flex items-center justify-center mb-2">
            <UserCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          
          {step === 'login' && <CardTitle className="text-xl">Student Login</CardTitle>}
          {step === 'verify' && <CardTitle className="text-xl">Verify Enrollment</CardTitle>}
          {step === 'register' && <CardTitle className="text-xl">Create Account</CardTitle>}
          
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {step === 'login' && "Access your personalized academic dashboard."}
            {step === 'verify' && "Select your college and enter your roll number to verify your records."}
            {step === 'register' && `Hi ${studentName}! Please set an email and password.`}
          </p>
        </CardHeader>
        
        <CardContent>
          
          {/* LOGIN FORM */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-field pl-10"
                    placeholder="student@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input-field pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full mt-6" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          )}

          {/* VERIFY FORM */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Institution</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-slate-400" />
                  </div>
                  <select
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                    required
                    className="input-field pl-10 appearance-none bg-white dark:bg-slate-900"
                  >
                    {institutions.length === 0 && <option value="">Loading institutions...</option>}
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Register / Roll Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IdCard className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={registerNumber}
                    onChange={(e) => setRegisterNumber(e.target.value)}
                    required
                    className="input-field pl-10 uppercase"
                    placeholder="e.g. 19CS001"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full mt-6" isLoading={isLoading} disabled={institutions.length === 0}>
                Verify My Details
              </Button>
            </form>
          )}

          {/* REGISTER FORM */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-field pl-10"
                    placeholder="student@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Create Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="input-field pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button type="button" variant="outline" onClick={resetToVerify} className="w-12 px-0" title="Go back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Button type="submit" className="flex-1" isLoading={isLoading}>
                  Complete Registration
                </Button>
              </div>
            </form>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
