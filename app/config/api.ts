type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface ApiConfig {
    devBaseUrl: string;
    prodBaseUrl: string;
    isDev: boolean; // 是否為開發環境
}

export class RestfulApi {
    private devBaseUrl: string;
    private prodBaseUrl: string;
    private isDev: boolean;

    constructor(config: ApiConfig) {
        this.devBaseUrl = config.devBaseUrl;
        this.prodBaseUrl = config.prodBaseUrl;
        this.isDev = config.isDev;
        if(this.isDev) {
            console.warn("Running in development mode. Using devBaseUrl:", this.devBaseUrl);
        }
        else {
            console.log("Running in production mode. Using prodBaseUrl:", this.prodBaseUrl);
        }
    }

    private get baseUrl(): string {
        return this.isDev ? this.devBaseUrl : this.prodBaseUrl;
    }

    private async request<T>(
        method: HttpMethod,
        endpoint: string,
        body?: any,
        headers?: Record<string, string>
    ): Promise<T> {
        const url = this.baseUrl + endpoint;

        const fetchOptions: RequestInit = {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(headers || {}),
            },
        };

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        try {
            console.log(`[RestfulApi] ${method} ${url}`);
            const response = await fetch(url, fetchOptions);
            
            if (!response.ok) {
                // 依需求可自訂錯誤格式
                const errorText = await response.text();
                console.error(`[RestfulApi] HTTP ${response.status} 錯誤:`, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            // 假設回傳皆為 JSON
            const data = (await response.json()) as T;
            return data;
        } catch (error: any) {
            // 可進行額外錯誤處理，例如日誌或通知
            console.error(`[RestfulApi] 請求失敗:`, {
                url,
                method,
                error: error?.message || error,
                errorType: error?.constructor?.name,
                isNetworkError: error?.message?.includes('Network request failed') || 
                               error?.message?.includes('Failed to fetch') ||
                               error?.message?.includes('NetworkError'),
            });
            
            // 如果是網路錯誤，提供更詳細的診斷資訊
            if (error?.message?.includes('Network request failed') || 
                error?.message?.includes('Failed to fetch')) {
                console.error(`[RestfulApi] 網路請求失敗，可能的原因：`);
                console.error(`   1. iOS ATS (App Transport Security) 阻止了 HTTP 請求`);
                console.error(`   2. 請確認 Info.plist 中已配置 NSExceptionAllowsInsecureHTTPLoads`);
                console.error(`   3. 當前 URL: ${url}`);
                console.error(`   4. 是否為 HTTPS: ${url.startsWith('https://')}`);
            }
            
            throw error;
        }
    }

    // GET 請求
    public get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
        return this.request<T>("GET", endpoint, undefined, headers);
    }

    // POST 請求
    public post<T>(
        endpoint: string,
        body: any,
        headers?: Record<string, string>
    ): Promise<T> {
        return this.request<T>("POST", endpoint, body, headers);
    }

    // PUT 請求
    public put<T>(
        endpoint: string,
        body: any,
        headers?: Record<string, string>
    ): Promise<T> {
        return this.request<T>("PUT", endpoint, body, headers);
    }

    // DELETE 請求
    public delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
        return this.request<T>("DELETE", endpoint, undefined, headers);
    }

    // PATCH 請求
    public patch<T>(
        endpoint: string,
        body: any,
        headers?: Record<string, string>
    ): Promise<T> {
        return this.request<T>("PATCH", endpoint, body, headers);
    }

    public currentBaseUrl(): string {
    return this.baseUrl;
  }
}
