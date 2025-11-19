
/**
 * INFRASTRUCTURE LAYER: HTTP Client
 * 
 * This class simulates a production-grade HTTP client like 'axios' or 'got'.
 * Features:
 * 1. Automatic JSON parsing.
 * 2. Robust Retry Logic (Exponential Backoff + Jitter).
 * 3. Type-safe responses.
 * 4. Centralized error handling.
 */

export interface HttpRequestConfig extends RequestInit {
  params?: Record<string, string | number>;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: HttpRequestConfig;
}

class HttpClient {
  private defaults: HttpRequestConfig;

  constructor(defaults: HttpRequestConfig = {}) {
    this.defaults = {
      retries: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...defaults,
    };
  }

  /**
   * GET Request
   */
  async get<T = any>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  /**
   * POST Request
   */
  async post<T = any>(url: string, data?: any, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>(url, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Core Request Logic with Retry Strategy
   */
  private async request<T>(url: string, config: HttpRequestConfig): Promise<HttpResponse<T>> {
    const finalConfig = { ...this.defaults, ...config };
    const { retries = 3, retryDelay = 1000 } = finalConfig;
    
    let attempt = 0;

    while (attempt <= retries) {
      try {
        // Construct URL with params
        const finalUrl = this.buildUrl(url, finalConfig.params);
        
        // Log for debugging (Simulation only)
        // console.log(`[HTTP] ${finalConfig.method} ${finalUrl} (Attempt ${attempt + 1})`);

        const response = await fetch(finalUrl, finalConfig);
        
        // Handle 429 (Rate Limit) or 5xx (Server Errors) by throwing to trigger catch block
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`HTTP Status ${response.status}`);
        }

        // For other errors (400, 401, 404), return response immediately (don't retry)
        if (!response.ok) {
          return this.createResponse<T>(response, finalConfig, null);
        }

        const data = await response.json().catch(() => null);
        return this.createResponse<T>(response, finalConfig, data);

      } catch (error) {
        attempt++;
        
        if (attempt > retries) {
          console.error(`[HTTP] Request failed after ${retries} retries: ${url}`);
          throw error;
        }

        // Exponential Backoff with Jitter
        // delay * 2^attempt + random_jitter
        const backoff = retryDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 200; 
        const waitTime = backoff + jitter;

        console.warn(`[HTTP] Retry ${attempt}/${retries} for ${url} in ${Math.round(waitTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Unreachable');
  }

  private buildUrl(url: string, params?: Record<string, string | number>): string {
    if (!params) return url;
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return `${url}${url.includes('?') ? '&' : '?'}${qs}`;
  }

  private createResponse<T>(res: Response, config: HttpRequestConfig, data: any): HttpResponse<T> {
    return {
      data: data as T,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      config,
    };
  }
}

// Export singleton instance
export const http = new HttpClient();
