type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface ApiConfig {
    devBaseUrl: string;
    prodBaseUrl: string;
    isDev: boolean; // 是否為開發環境
}

// 單次請求逾時（ms）。原本用裸 fetch 不設逾時，iOS/NSURLSession 預設要等 ~60s 才失敗，
// 造成金幣等請求在網路未就緒時卡住約一分鐘（期間 coinContext 的 isLoadingRef 鎖住無法重試）。
// 設一個較短的逾時讓卡住的請求快速失敗、快速釋放鎖，上層才能即時重試。
const REQUEST_TIMEOUT_MS = 15000;

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

        // 以 AbortController 實作逾時：超過 REQUEST_TIMEOUT_MS 未回應就中止該請求。
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        fetchOptions.signal = controller.signal;

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
            // fetch 被 AbortController 中止（逾時）時，error.name === 'AbortError'，
            // 統一轉成語意明確的逾時錯誤，方便上層辨識與記錄。
            if (error?.name === 'AbortError') {
                console.error(`[RestfulApi] 請求逾時（>${REQUEST_TIMEOUT_MS}ms）:`, { url, method });
                throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms: ${url}`);
            }

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
        } finally {
            // 無論成功或失敗都清掉計時器，避免請求已結束後才誤觸 abort。
            clearTimeout(timeoutId);
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
