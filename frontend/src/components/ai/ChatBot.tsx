import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
}

export function ChatBot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Initial greeting based on role
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: user?.role === 'admin' 
            ? "Hello Admin! I can help you analyze institution data. Try asking: 'What is the overall pass percentage?' or 'Show me the top 3 students'."
            : "Hi there! I can help answer questions about your academic records. Try asking: 'What was my GPA last semester?' or 'Which subject did I score highest in?'"
        }
      ]);
    }
  }, [isOpen, user, messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Determine endpoint based on role
      const endpoint = user?.role === 'admin' 
        ? '/api/ai/admin/chat' 
        : '/api/ai/student/chat';

      const response = await api.post(endpoint, {
        message: userMessage.content,
        // Send history for context (last 5 messages)
        history: messages.slice(-5).map(m => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: m.content
        }))
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response || "I couldn't process that request."
      };
      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: error.response?.data?.detail || "Sorry, I encountered an error. Please try again later."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show for authenticated users
  if (!user) return null;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-all duration-300 z-40 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100 hover:scale-110'}`}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="w-6 h-6 absolute -top-1 -right-1 text-yellow-300 animate-pulse" size={16} />
        <Bot className="w-7 h-7" />
      </button>

      {/* Chat Window Container */}
      <div 
        className={`fixed bottom-6 right-6 w-[90vw] max-w-[380px] h-[550px] max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right z-50 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">ResultSphere AI</h3>
              <p className="text-xs text-indigo-100 opacity-90">{user.role === 'admin' ? 'Institution Analytics' : 'Student Assistant'}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 
                msg.role === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' : 
                'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : 
                 msg.role === 'error' ? <AlertCircle className="w-4 h-4" /> : 
                 <Bot className="w-4 h-4" />}
              </div>
              
              <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-sm' 
                  : msg.role === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-100 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-200 rounded-tl-sm'
                    : 'bg-white border border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 rounded-tl-sm shadow-sm'
              }`}>
                {/* Parse basic markdown (bold) visually quickly */}
                {msg.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>
                    {line.split('**').map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
                  </p>
                ))}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 flex-row">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-xs text-slate-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form 
            onSubmit={handleSubmit}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white focus:border-indigo-500 text-sm rounded-full px-4 py-2.5 outline-none transition-all dark:text-white"
              disabled={isLoading}
            />
            <button 
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
          <div className="text-center mt-2">
             <span className="text-[10px] text-slate-400">Powered by Google Gemini</span>
          </div>
        </div>
      </div>
    </>
  );
}
