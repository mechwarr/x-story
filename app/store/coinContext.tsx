// app/store/coinContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import tokenStorage from '../auth/Storage';
import { getUserCoinBalance } from '../config/userApiClient';

/** 同一時段內重複呼叫 refresh 的最小間隔（ms），避免轉場/連鎖造成重複打 API */
const MIN_REFRESH_INTERVAL_MS = 30_000;

interface CoinContextType {
  coins: number;
  setCoins: (coins: number) => Promise<void>;
  /** 從 API 刷新餘額；force 為 true 時略過短時間防抖（例如 IAP/購買成功後應傳 true） */
  refreshCoins: (force?: boolean) => Promise<void>;
}

const CoinContext = createContext<CoinContextType | undefined>(undefined);

/** 供登出時重置金幣狀態，避免換帳號後仍顯示上一用戶餘額 */
export type CoinResetRef = React.MutableRefObject<(() => void) | null>;

interface CoinProviderProps {
  children: ReactNode;
  /** 可選：登出時呼叫 ref.current() 可將金幣狀態重置為 0 */
  resetRef?: CoinResetRef;
}

export function CoinProvider({ children, resetRef }: CoinProviderProps) {
  const [coins, setCoinsState] = useState<number>(0);
  const lastRefreshAt = useRef<number>(0);
  const isLoadingRef = useRef<boolean>(false);

  // 暴露重置函數給外部（登出時呼叫）
  useEffect(() => {
    if (!resetRef) return;
    resetRef.current = () => {
      setCoinsState(0);
      lastRefreshAt.current = 0;
      console.log('[coinContext] 已重置金幣狀態（登出）');
    };
    return () => {
      resetRef.current = null;
    };
  }, [resetRef]);

  // 從 Storage 載入金幣（初始化時使用）
  const loadCoinsFromStorage = useCallback(async () => {
    try {
      const storedCoins = await tokenStorage.getUserCoin();
      setCoinsState(storedCoins ?? 0);
    } catch (error) {
      console.error('載入金幣失敗:', error);
      setCoinsState(0);
    }
  }, []);

  // 從 API 獲取最新的金幣餘額（內部實作；並發呼叫時只執行一次）
  const loadCoinsFromAPI = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      const balance = await getUserCoinBalance();
      setCoinsState(balance);
      await tokenStorage.setUserCoin(balance);
      lastRefreshAt.current = Date.now();
      console.log('[coinContext] ✓ 從 API 刷新金幣餘額:', balance);
    } catch (error) {
      console.error('[coinContext] 從 API 獲取金幣餘額失敗:', error);
      await loadCoinsFromStorage();
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadCoinsFromStorage]);

  // 初始化時只從 Storage 載入金幣（快速顯示）
  useEffect(() => {
    loadCoinsFromStorage();
  }, [loadCoinsFromStorage]);

  // 設定金幣（同時更新 Storage）
  const setCoins = useCallback(async (newCoins: number) => {
    try {
      setCoinsState(newCoins);
      await tokenStorage.setUserCoin(newCoins);
    } catch (error) {
      console.error('設定金幣失敗:', error);
    }
  }, []);

  /**
   * 刷新金幣（從 API 重新獲取最新餘額）。
   * 短時間內重複呼叫會略過 API；傳入 force === true 時強制打 API（例如 IAP/購買成功後）。
   */
  const refreshCoins = useCallback(async (force?: boolean) => {
    const now = Date.now();
    if (!force && now - lastRefreshAt.current < MIN_REFRESH_INTERVAL_MS) {
      return;
    }
    await loadCoinsFromAPI();
  }, [loadCoinsFromAPI]);

  return (
    <CoinContext.Provider value={{ coins, setCoins, refreshCoins }}>
      {children}
    </CoinContext.Provider>
  );
}

export function useCoins(): CoinContextType {
  const context = useContext(CoinContext);
  if (context === undefined) {
    throw new Error('useCoins must be used within a CoinProvider');
  }
  return context;
}

