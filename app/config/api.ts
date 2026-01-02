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
            const response = await fetch(url, fetchOptions);
            if (!response.ok) {
                // 依需求可自訂錯誤格式
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            // 假設回傳皆為 JSON
            const data = (await response.json()) as T;
            return data;
        } catch (error) {
            // 可進行額外錯誤處理，例如日誌或通知
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
