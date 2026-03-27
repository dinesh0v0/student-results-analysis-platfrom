import axios, { AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 15000;

export const SERVICE_UNAVAILABLE_MESSAGE =
  'Service unavailable. Please try again in a moment.';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function isRequestCanceled(error: unknown) {
  return axios.isAxiosError(error) && error.code === 'ERR_CANCELED';
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
) {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') {
      return '';
    }

    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Please try again.';
    }

    if (!error.response) {
      return SERVICE_UNAVAILABLE_MESSAGE;
    }

    if (error.response.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }

    if (error.response.status === 429) {
      return 'I am currently overloaded, please try again in a moment.';
    }

    if (error.response.status >= 500) {
      return SERVICE_UNAVAILABLE_MESSAGE;
    }

    const detail = error.response.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }
  }

  return fallback;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;
