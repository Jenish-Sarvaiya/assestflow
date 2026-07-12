const BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  body?: any;
}

export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('assetflow_token');
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: `HTTP error! Status: ${response.status}` };
    }
    
    // Package specific custom API error properties (e.g. currentHolder for allocation block)
    const err: any = new Error(errorData.error || 'Something went wrong');
    err.status = response.status;
    err.details = errorData;
    throw err;
  }

  // Handle empty responses (like 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  get: <T = any>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T = any>(path: string, body?: any, options?: RequestOptions) => request<T>(path, { ...options, method: 'POST', body }),
  patch: <T = any>(path: string, body?: any, options?: RequestOptions) => request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = any>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};
