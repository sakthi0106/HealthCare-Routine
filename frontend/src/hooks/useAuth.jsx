import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearSession, getRole, getToken, saveSession } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(getToken() ? getRole() : null);

  const login = useCallback(async (pin) => {
    const data = await api("/api/auth/login", { method: "POST", body: { pin }, auth: false });
    saveSession(data.token, data.role);
    setRole(data.role);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setRole(null);
  }, []);

  useEffect(() => {
    window.addEventListener("fhc-auth-expired", logout);
    return () => window.removeEventListener("fhc-auth-expired", logout);
  }, [logout]);

  return <AuthContext.Provider value={{ role, isAdmin: role === "admin", login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
