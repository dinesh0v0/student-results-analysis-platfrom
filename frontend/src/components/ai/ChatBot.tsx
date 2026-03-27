import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, Loader2, Send, Sparkles, User, X } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import api, { getApiErrorMessage, isRequestCanceled } from '../../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
}

function normalizeChatInput(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

export function ChatBot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setIsOpen(false);
      return;
    }

    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            user.role === 'admin'
              ? 'Hello Admin. I can help summarize institution performance, pass rates, and subject trends.'
              : 'Hi. I can help explain your grades, semester performance, and report details.',
        },
      ]);
    }
  }, [isOpen, user, messages.length]);

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedInput = normalizeChatInput(input);
    if (!normalizedInput || isLoading || !user) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: normalizedInput,
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const endpoint = user.role === 'admin' ? '/api/ai/admin/chat' : '/api/ai/student/chat';
      const { data } = await api.post(
        endpoint,
        { message: normalizedInput },
        { signal: controller.signal }
      );

      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response || 'I could not process that request right now.',
        },
      ]);
    } catch (error) {
      if (isRequestCanceled(error)) {
        return;
      }

      setMessages((previous) => [
        ...previous,
        {
          id: `error-${Date.now()}`,
          role: 'error',
          content: getApiErrorMessage(
            error,
            'I am currently overloaded, please try again in a moment.'
          ),
        },
      ]);
    } finally {
      requestControllerRef.current = null;
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-all duration-300 ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100 hover:scale-110 hover:bg-indigo-700'
        }`}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="absolute -right-1 -top-1 h-4 w-4 animate-pulse text-yellow-300" />
        <Bot className="h-7 w-7" />
      </button>

      <div
        className={`fixed bottom-6 right-6 z-50 flex h-[550px] max-h-[80vh] w-[90vw] max-w-[380px] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${
          isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-0 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2 backdrop-blur-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">ResultSphere AI</h3>
              <p className="text-xs text-indigo-100 opacity-90">
                {user.role === 'admin' ? 'Institution Analytics' : 'Student Assistant'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 transition-colors hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/50">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  message.role === 'user'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                    : message.role === 'error'
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : message.role === 'error' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  message.role === 'user'
                    ? 'rounded-tr-sm bg-indigo-600 text-white'
                    : message.role === 'error'
                      ? 'rounded-tl-sm border border-red-100 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200'
                      : 'rounded-tl-sm border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {message.content.split('\n').map((line, index) => (
                  <p key={`${message.id}-${index}`} className={index > 0 ? 'mt-2' : ''}>
                    {line.split('**').map((part, partIndex) =>
                      partIndex % 2 === 1 ? <strong key={partIndex}>{part}</strong> : part
                    )}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {isLoading ? (
            <div className="flex flex-row gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span className="text-xs text-slate-500">Thinking...</span>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, 500))}
              placeholder="Ask a question..."
              className="flex-1 rounded-full border-transparent bg-slate-100 px-4 py-2.5 text-sm outline-none transition-all focus:border-indigo-500 focus:bg-white dark:bg-slate-800 dark:text-white"
              disabled={isLoading}
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!normalizeChatInput(input) || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600"
            >
              <Send className="ml-0.5 h-4 w-4" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[10px] text-slate-400">Powered by Google Gemini</span>
          </div>
        </div>
      </div>
    </>
  );
}
