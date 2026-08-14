import { attemptReauth } from "./sessionAuth";
import { pingSuspensionGuard } from "./suspensionGuard";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface ApiConfig {
    devBaseUrl: string;
    prodBaseUrl: string;
    isDev: boolean; // 是否為開發環境
}

// 帶上這個 header（值為 "1"）的請求，收到 401 時「不會」自動刷新+重試。
// 用於本來就在處理登入狀態、重試沒有意義的呼叫（例如登出）。request() 會在送出前移除此 header。
export const SKIP_REAUTH_HEADER = "X-Skip-Reauth";

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
        headers?: Record<string, string>,
        // 內部旗標：此次是否為「刷新 token 後的重試」。true 時即使再收到 401 也不再刷新，避免無限迴圈。
        isRetry: boolean = false
    ): Promise<T> {
        const url = this.baseUrl + endpoint;

        // 組出實際要送出的 header；若帶有 SKIP_REAUTH_HEADER 則記錄下來並在送出前移除（不外送）。
        const outgoingHeaders: Record<string, string> = {
            "Content-Type": "application/json",
            ...(headers || {}),
        };
        const skipReauth = outgoingHeaders[SKIP_REAUTH_HEADER] === "1";
        if (SKIP_REAUTH_HEADER in outgoingHeaders) {
            delete outgoingHeaders[SKIP_REAUTH_HEADER];
        }
        const hasAuthHeader = !!outgoingHeaders["Authorization"];

        // 停權強制驅離：任何帶 token 的 API 活動都觸發（節流的）背景停權重查，
        // roleLevel <= 0 時跳停權提示並登出。同步返回、不阻塞也不影響本次請求。
        if (hasAuthHeader && !isRetry) {
            pingSuspensionGuard();
        }

        const fetchOptions: RequestInit = {
            method,
            headers: outgoingHeaders,
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
                // 被動式 Token 刷新：帶授權的請求收到 401（token 過期）時，
                // 嘗試刷新一次 token 再重送原請求一次。條件：
                //   - 狀態為 401（403 屬「權限不足」，刷新也沒用，交給上層處理）
                //   - 有帶 Authorization（未授權的公開 API 不處理）
                //   - 非重試（避免無限迴圈）
                //   - 未指定略過（例如登出）
                //   - 非刷新端點本身（雙保險；刷新請求本來就不帶 Authorization）
                if (
                    response.status === 401 &&
                    hasAuthHeader &&
                    !isRetry &&
                    !skipReauth &&
                    !endpoint.includes("auth/refresh")
                ) {
                    // 401 的 body 這裡不需要，但要讀掉以釋放連線資源。
                    await response.text().catch(() => undefined);
                    console.warn(`[RestfulApi] 收到 401，嘗試刷新 token 後重試一次: ${method} ${url}`);

                    // attemptReauth 內部為單飛：多支同時 401 的請求只會觸發一次真正的刷新。
                    const outcome = await attemptReauth();

                    if (outcome.ok) {
                        console.log(`[RestfulApi] ✅ 刷新成功，以新 token 重試: ${method} ${url}`);
                        const retryHeaders: Record<string, string> = {
                            ...outgoingHeaders,
                            Authorization: `Bearer ${outcome.accessToken}`,
                        };
                        // 重送一次；isRetry=true 確保這次即使又 401 也不再刷新。
                        return await this.request<T>(method, endpoint, body, retryHeaders, true);
                    }

                    // 刷新失敗：token_invalid（權限過期，attemptReauth 已觸發登出 UI）或 network_error（不登出）。
                    // 兩者都照原本流程往上拋 401，讓各 caller 維持既有的容錯（回 null／空陣列／退回公開清單）。
                    console.warn(
                        `[RestfulApi] 刷新未成功（reason=${outcome.reason}），維持 401 拋出: ${method} ${url}`
                    );
                    throw new Error(`HTTP 401: Unauthorized (token refresh ${outcome.reason})`);
                }

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
