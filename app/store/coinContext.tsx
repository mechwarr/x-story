// app/store/coinContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import tokenStorage from '../auth/Storage';
import { getUserCoinBalance } from '../config/userApiClient';

interface CoinContextType {
  coins: number;
  setCoins: (coins: number) => Promise<void>;
  refreshCoins: () => Promise<void>;
}

const CoinContext = createContext<CoinContextType | undefined>(undefined);

export function CoinProvider({ children }: { children: ReactNode }) {
  const [coins, setCoinsState] = useState<number>(0);

  // 從 Storage 載入金幣（初始化時使用）
  const loadCoinsFromStorage = async () => {
    try {
      const storedCoins = await tokenStorage.getUserCoin();
      setCoinsState(storedCoins ?? 0);
    } catch (error) {
      console.error('載入金幣失敗:', error);
      setCoinsState(0);
    }
  };

  // 從 API 獲取最新的金幣餘額
  const loadCoinsFromAPI = async () => {
    try {
      const balance = await getUserCoinBalance();
      setCoinsState(balance);
      // 同時更新本地 Storage
      await tokenStorage.setUserCoin(balance);
      console.log('[coinContext] ✓ 從 API 刷新金幣餘額:', balance);
    } catch (error) {
      console.error('[coinContext] 從 API 獲取金幣餘額失敗:', error);
      // 如果 API 失敗，嘗試從本地 Storage 載入
      await loadCoinsFromStorage();
    }
  };

  // 初始化時從 Storage 載入金幣（快速顯示）
  useEffect(() => {
    loadCoinsFromStorage();
    // 然後從 API 獲取最新餘額
    loadCoinsFromAPI();
  }, []);

  // 設定金幣（同時更新 Storage）
  const setCoins = async (newCoins: number) => {
    try {
      setCoinsState(newCoins);
      await tokenStorage.setUserCoin(newCoins);
    } catch (error) {
      console.error('設定金幣失敗:', error);
    }
  };

  // 刷新金幣（從 API 重新獲取最新餘額）
  const refreshCoins = async () => {
    await loadCoinsFromAPI();
  };

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

