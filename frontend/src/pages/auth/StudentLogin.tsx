import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeIcon as IdCard, Building, Lock, Mail, UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { useAuth } from '../../contexts/AuthContext';
import api, { getApiErrorMessage, isRequestCanceled } from '../../lib/api';
import { Institution } from '../../types';

type Step = 'verify' | 'register' | 'login';

interface LoginResponse {
  access_token: string;
  user_id: string;
  email: string;
  role: 'student';
  institution_id: string;
  student_id: string;
}

export default function StudentLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('login');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState('');

  const [institutionId, setInstitutionId] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const fetchInstitutions = async () => {
      setInstitutionsLoading(true);
      setInstitutionsError('');

      try {
        const { data } = await api.get('/api/auth/institutions', { signal: controller.signal });
        setInstitutions(data);
        if (data.length > 0) {
          setInstitutionId((current) => current || data[0].id);
        }
      } catch (error) {
        if (isRequestCanceled(error)) {
          return;
        }

        setInstitutionsError(getApiErrorMessage(error, 'Unable to load institutions right now.'));
      } finally {
        setInstitutionsLoading(false);
      }
    };

    fetchInstitutions();
    return () => controller.abort();
  }, []);

  const handleLoginSuccess = (data: LoginResponse) => {
    login(data.access_token, {
      id: data.user_id,
      email: data.email,
      role: data.role,
      institution_id: data.institution_id,
      student_id: data.student_id,
    });

    toast.success('Welcome to ResultSphere.');
    navigate('/student');
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!institutionId || !registerNumber.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post('/api/auth/student/verify', {
        institution_id: institutionId,
        register_number: registerNumber.trim().toUpperCase(),
      });

      setStudentName(data.student_name);
      setRegisterNumber(data.register_number);
      setStep('register');
      toast.success('Student record verified. Please create your account.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Verification failed. Please check your details.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await api.post('/api/auth/student/register', {
        institution_id: institutionId,
        register_number: registerNumber.trim().toUpperCase(),
        email,
        password,
      });
      handleLoginSuccess(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Registration failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await api.post('/api/auth/student/login', { email, password });
      handleLoginSuccess(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Invalid email or password.'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetToVerify = () => {
    setStep('verify');
    setPassword('');
    setEmail('');
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="glass-panel w-full max-w-md animate-slide-up">
        <div className="mb-6 flex border-b border-slate-200 dark:border-slate-800">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${step === 'login' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            onClick={() => setStep('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${step === 'verify' || step === 'register' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            onClick={() => setStep('verify')}
          >
            First Time? Register
          </button>
        </div>

        <CardHeader className="space-y-2 pt-0 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
            <UserCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>

          {step === 'login' ? <CardTitle className="text-xl">Student Login</CardTitle> : null}
          {step === 'verify' ? <CardTitle className="text-xl">Verify Enrollment</CardTitle> : null}
          {step === 'register' ? <CardTitle className="text-xl">Create Account</CardTitle> : null}

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {step === 'login' && 'Access your personalized academic dashboard.'}
            {step === 'verify' && 'Select your college and enter your roll number to verify your records.'}
            {step === 'register' && `Hi ${studentName}. Please set an email and password.`}
          </p>
        </CardHeader>

        <CardContent>
          {institutionsError && step !== 'login' ? (
            <div className="mb-4">
              <StatusMessage
                title="Institution list unavailable"
                message={institutionsError}
                variant="error"
              />
            </div>
          ) : null}

          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="input-field pl-10"
                    placeholder="student@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="input-field pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Button type="submit" className="mt-6 w-full" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          ) : null}

          {step === 'verify' ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Institution</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Building className="h-5 w-5 text-slate-400" />
                  </div>
                  <select
                    value={institutionId}
                    onChange={(event) => setInstitutionId(event.target.value)}
                    required
                    className="input-field appearance-none bg-white pl-10 dark:bg-slate-900"
                    disabled={institutionsLoading || !!institutionsError}
                  >
                    {institutionsLoading ? <option value="">Loading institutions...</option> : null}
                    {!institutionsLoading && institutions.length === 0 ? (
                      <option value="">No institutions available</option>
                    ) : null}
                    {institutions.map((institution) => (
                      <option key={institution.id} value={institution.id}>
                        {institution.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Register / Roll Number</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <IdCard className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={registerNumber}
                    onChange={(event) => setRegisterNumber(event.target.value.toUpperCase())}
                    required
                    className="input-field pl-10 uppercase"
                    placeholder="e.g. 19CS001"
                    disabled={!!institutionsError}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-6 w-full"
                isLoading={isLoading}
                disabled={institutionsLoading || institutions.length === 0 || !!institutionsError}
              >
                Verify My Details
              </Button>
            </form>
          ) : null}

          {step === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="input-field pl-10"
                    placeholder="student@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Create Password</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    className="input-field pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={resetToVerify} className="w-12 px-0" title="Go back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Button type="submit" className="flex-1" isLoading={isLoading}>
                  Complete Registration
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
