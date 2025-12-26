// app/store/coinContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import tokenStorage from '../auth/Storage';

interface CoinContextType {
  coins: number;
  setCoins: (coins: number) => Promise<void>;
  refreshCoins: () => Promise<void>;
}

const CoinContext = createContext<CoinContextType | undefined>(undefined);

export function CoinProvider({ children }: { children: ReactNode }) {
  const [coins, setCoinsState] = useState<number>(0);

  // 從 Storage 載入金幣
  const loadCoins = async () => {
    try {
      const storedCoins = await tokenStorage.getUserCoin();
      setCoinsState(storedCoins ?? 0);
    } catch (error) {
      console.error('載入金幣失敗:', error);
      setCoinsState(0);
    }
  };

  // 初始化時載入金幣
  useEffect(() => {
    loadCoins();
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

  // 刷新金幣（從 Storage 重新載入）
  const refreshCoins = async () => {
    await loadCoins();
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

