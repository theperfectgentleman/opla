/**
 * AuthContext.tsx
 * Global auth state for the mobile app.
 * Handles: online login, PIN setup, offline PIN login, logout, session bootstrap.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthSession, User } from '@opla/types';
import {
  loadSession,
  clearSession,
  recordOnlineAuth,
  setPin,
  verifyPin,
  hasPinAccess,
  requiresOnlineLogin,
  pinDaysRemaining,
} from '../services/authService';
import { authAPI, orgAPI } from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuthStatus =
  | 'loading'        // bootstrapping
  | 'unauthenticated' // no session at all
  | 'needs_online'   // has session but PIN expired → must go online
  | 'needs_pin'      // online auth done, PIN not yet set
  | 'pin_ready'      // PIN is active; offline login available
  | 'authenticated'; // fully authenticated this session

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: AuthSession | null;
  pinDays: number | null;

  /** Full online login via email+password */
  loginEmail: (email: string, password: string) => Promise<void>;
  /** Full online login via OTP */
  loginPhone: (phone: string, otp: string) => Promise<void>;
  /** Request OTP (returns nothing, side-effect only) */
  requestOtp: (phone: string) => Promise<void>;
  /** Set PIN after first online login */
  setupPin: (pin: string) => Promise<void>;
  /** Offline PIN login */
  loginWithPin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Refresh status after external changes */
  refresh: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pinDays, setPinDays] = useState<number | null>(null);

  const computeStatus = useCallback(async (): Promise<AuthStatus> => {
    const sess = await loadSession();
    if (!sess) return 'unauthenticated';
    const needsOnline = await requiresOnlineLogin();
    if (needsOnline) return 'needs_online';
    const hasPin = await hasPinAccess();
    if (!hasPin) return 'needs_pin';
    return 'pin_ready';
  }, []);

  const bootstrap = useCallback(async () => {
    const sess = await loadSession();
    setSession(sess);
    const days = await pinDaysRemaining();
    setPinDays(days);
    const st = await computeStatus();
    setStatus(st);
  }, [computeStatus]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // ── After successful online API call, record session ─────────────────────
  const finalizeOnlineAuth = async (
    apiUser: any,
    accessToken: string,
    refreshToken: string,
  ) => {
    const orgList = await orgAPI.list().catch(() => []);
    const orgIds = Array.isArray(orgList) ? orgList.map((o: any) => o.id as string) : [];
    const user: User = {
      id: apiUser.id,
      email: apiUser.email,
      phone: apiUser.phone,
      full_name: apiUser.full_name,
      name: apiUser.full_name || apiUser.email || apiUser.phone || 'User',
    };
    const sess = await recordOnlineAuth(user, accessToken, refreshToken, orgIds);
    setSession(sess);
    setPinDays(7);
    // PIN not yet set after fresh online auth unless they had one
    setStatus(sess.pinHash ? 'authenticated' : 'needs_pin');
  };

  // ── Online login methods ─────────────────────────────────────────────────
  const loginEmail = async (email: string, password: string) => {
    const res = await authAPI.loginEmail(email, password);
    await finalizeOnlineAuth(res.user, res.access_token, res.refresh_token);
  };

  const requestOtp = async (phone: string) => {
    await authAPI.requestOtp(phone);
  };

  const loginPhone = async (phone: string, otp: string) => {
    const res = await authAPI.verifyOtp(phone, otp);
    await finalizeOnlineAuth(res.user, res.access_token, res.refresh_token);
  };

  // ── PIN methods ──────────────────────────────────────────────────────────
  const setupPin = async (pin: string) => {
    await setPin(pin);
    const sess = await loadSession();
    setSession(sess);
    setStatus('authenticated');
  };

  const loginWithPin = async (pin: string) => {
    const sess = await verifyPin(pin);
    setSession(sess);
    setStatus('authenticated');
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = async () => {
    await clearSession();
    setSession(null);
    setPinDays(null);
    setStatus('unauthenticated');
  };

  const refresh = bootstrap;

  return (
    <AuthContext.Provider
      value={{
        status,
        user: session?.user ?? null,
        session,
        pinDays,
        loginEmail,
        loginPhone,
        requestOtp,
        setupPin,
        loginWithPin,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
