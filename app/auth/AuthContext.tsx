// auth/AuthContext.tsx
import React, { createContext, useContext } from "react";

type AuthContextValue = {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  logout: () => Promise<void> | void;
  /** 僅清除本地資料並登出，不呼叫後端登出（用於刪除帳號後） */
  logoutLocalOnly: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AuthContextValue;
}) => <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
