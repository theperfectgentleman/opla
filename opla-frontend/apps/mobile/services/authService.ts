/**
 * authService.ts
 * Handles online authentication, PIN lifecycle, and session management.
 *
 * Security rules:
 * - PIN is never stored in plain text — always as sha256 hex
 * - Online auth refreshes the 7-day PIN window
 * - After 7 days without online auth the PIN is invalidated; user must go online
 * - Secure storage keys are prefixed with 'opla_'
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { AuthSession, User } from '@opla/types';

const KEYS = {
  SESSION: 'opla_auth_session',
} as const;

const PIN_VALIDITY_DAYS = 7;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

function isPinExpired(onlineAuthAt: string): boolean {
  const authTime = new Date(onlineAuthAt).getTime();
  const expiryTime = authTime + PIN_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > expiryTime;
}

// ─── Session persistence ─────────────────────────────────────────────────────

export async function saveSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(KEYS.SESSION, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEYS.SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.SESSION);
}

// ─── Online auth ─────────────────────────────────────────────────────────────

/**
 * Called after a successful API login. Merges tokens/user into session
 * and marks the online auth timestamp (resetting the 7-day PIN window).
 */
export async function recordOnlineAuth(
  user: User,
  accessToken: string,
  refreshToken: string,
  orgIds: string[] = [],
): Promise<AuthSession> {
  const existing = await loadSession();
  const session: AuthSession = {
    user,
    accessToken,
    refreshToken,
    onlineAuthAt: new Date().toISOString(),
    pinHash: existing?.pinHash ?? null, // preserve existing PIN
    orgIds,
  };
  await saveSession(session);
  return session;
}

// ─── PIN management ──────────────────────────────────────────────────────────

/**
 * Create or replace the stored PIN. Requires an active, non-expired session
 * (i.e. user must have recently completed online auth).
 */
export async function setPin(pin: string): Promise<void> {
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits');
  }
  const session = await loadSession();
  if (!session) throw new Error('No active session. Please log in online first.');
  if (isPinExpired(session.onlineAuthAt)) {
    throw new Error('Session expired. Please log in online to set a new PIN.');
  }
  const pinHash = await hashPin(pin);
  await saveSession({ ...session, pinHash });
}

/**
 * Validate a PIN attempt for offline login.
 * Returns the session on success, throws on failure.
 */
export async function verifyPin(pin: string): Promise<AuthSession> {
  const session = await loadSession();
  if (!session?.pinHash) {
    throw new Error('No PIN set. Please log in online first.');
  }
  if (isPinExpired(session.onlineAuthAt)) {
    // invalidate stored PIN to force online re-auth
    await saveSession({ ...session, pinHash: null });
    throw new Error('PIN expired. Please log in online to reset it.');
  }
  const hash = await hashPin(pin);
  if (hash !== session.pinHash) {
    throw new Error('Incorrect PIN.');
  }
  return session;
}

/** Returns days remaining before PIN expires (0 if expired, null if no PIN). */
export async function pinDaysRemaining(): Promise<number | null> {
  const session = await loadSession();
  if (!session?.pinHash) return null;
  const authTime = new Date(session.onlineAuthAt).getTime();
  const expiryTime = authTime + PIN_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
  const diff = expiryTime - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

/** Whether the current session has a valid (non-expired) PIN. */
export async function hasPinAccess(): Promise<boolean> {
  const session = await loadSession();
  if (!session?.pinHash) return false;
  return !isPinExpired(session.onlineAuthAt);
}

/** Whether an online login is required (no session or PIN expired). */
export async function requiresOnlineLogin(): Promise<boolean> {
  const session = await loadSession();
  if (!session) return true;
  // If PIN exists and is expired, online login is required
  if (session.pinHash && isPinExpired(session.onlineAuthAt)) return true;
  return false;
}
