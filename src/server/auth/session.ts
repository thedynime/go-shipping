import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import * as schema from '../db/schema';

export type UserRole =
  | 'super_admin'
  | 'ops_manager'
  | 'warehouse_staff'
  | 'sales_team'
  | 'support_agent'
  | 'customer';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: string;
  avatarUrl?: string | null;
  phone?: string;
  companyName?: string;
  address?: string;
  binNumber?: string;
  impersonatedBy?: {
    id: string;
    fullName: string;
    role: string;
    originalSessionId: string;
  };
}

export interface SessionData {
  sessionId: string;
  user: AuthUser;
  expiresAt: Date;
}

// Global session store attached to globalThis so Astro dev and SSR bundles share the exact same state
declare global {
  var __goshipping_sessions: Map<string, SessionData> | undefined;
  var __goshipping_accounts: AuthUser[] | undefined;
  var __goshipping_passwords: Map<string, string> | undefined;
  var __goshipping_otps: Map<string, { code: string; expiresAt: number }> | undefined;
}

const memorySessions: Map<string, SessionData> =
  globalThis.__goshipping_sessions || new Map<string, SessionData>();
globalThis.__goshipping_sessions = memorySessions;

const memoryPasswords: Map<string, string> =
  globalThis.__goshipping_passwords || new Map<string, string>();
globalThis.__goshipping_passwords = memoryPasswords;

const memoryOtps: Map<string, { code: string; expiresAt: number }> =
  globalThis.__goshipping_otps || new Map<string, { code: string; expiresAt: number }>();
globalThis.__goshipping_otps = memoryOtps;

const STORE_PATH = path.resolve(process.cwd(), '.auth_store.json');

interface AuthStoreData {
  sessions: Array<{
    sessionId: string;
    user: AuthUser;
    expiresAt: string;
  }>;
  accounts: AuthUser[];
  passwords: Record<string, string>;
}

export function loadAuthStore(): void {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const data: AuthStoreData = JSON.parse(raw);
      if (Array.isArray(data.sessions)) {
        for (const s of data.sessions) {
          const exp = new Date(s.expiresAt);
          if (exp.getTime() > Date.now()) {
            memorySessions.set(s.sessionId, {
              sessionId: s.sessionId,
              user: s.user,
              expiresAt: exp,
            });
          }
        }
      }
      if (Array.isArray(data.accounts)) {
        if (!globalThis.__goshipping_accounts) {
          globalThis.__goshipping_accounts = [...DEFAULT_ACCOUNTS];
        }
        for (const acc of data.accounts) {
          if (!globalThis.__goshipping_accounts.some((a) => a.id === acc.id || a.email.toLowerCase() === acc.email.toLowerCase())) {
            globalThis.__goshipping_accounts.push(acc);
          }
        }
      }
      if (data.passwords && typeof data.passwords === 'object') {
        for (const [k, v] of Object.entries(data.passwords)) {
          memoryPasswords.set(k.toLowerCase().trim(), v);
        }
      }
    }
  } catch (e) {
    console.error('[AuthStore] Error loading auth store:', e);
  }
}

export function saveAuthStore(): void {
  try {
    const validSessions = Array.from(memorySessions.values())
      .filter((s) => s.expiresAt.getTime() > Date.now())
      .map((s) => ({
        sessionId: s.sessionId,
        user: s.user,
        expiresAt: s.expiresAt.toISOString(),
      }));

    const accounts = (globalThis.__goshipping_accounts || DEFAULT_ACCOUNTS).filter(
      (acc) => !DEFAULT_ACCOUNTS.some((d) => d.id === acc.id)
    );

    const passwords: Record<string, string> = {};
    for (const [k, v] of memoryPasswords.entries()) {
      passwords[k] = v;
    }

    const data: AuthStoreData = {
      sessions: validSessions,
      accounts,
      passwords,
    };

    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[AuthStore] Error saving auth store:', e);
  }
}

/**
 * Get all active user accounts (predefined defaults + dynamic signups)
 */
export function getAllAccounts(): AuthUser[] {
  if (!globalThis.__goshipping_accounts) {
    globalThis.__goshipping_accounts = [...DEFAULT_ACCOUNTS];
  }
  return globalThis.__goshipping_accounts;
}

/**
 * Register a new user account dynamically into session store
 */
export function registerAccount(user: AuthUser, password?: string): void {
  const accounts = getAllAccounts();
  const existingIdx = accounts.findIndex((a) => a.id === user.id || a.email.toLowerCase() === user.email.toLowerCase());
  if (existingIdx >= 0) {
    accounts[existingIdx] = user;
  } else {
    accounts.push(user);
  }
  if (password) {
    memoryPasswords.set(user.email.toLowerCase().trim(), password);
  }
  saveAuthStore();
}

/**
 * Verify account password for in-memory or default accounts
 */
export function verifyAccountPassword(email: string, password: string): boolean {
  const normalized = email.toLowerCase().trim();
  if (memoryPasswords.has(normalized)) {
    return memoryPasswords.get(normalized) === password;
  }
  // Predefined default accounts accept password
  const isDefault = DEFAULT_ACCOUNTS.some((a) => a.email.toLowerCase() === normalized);
  if (isDefault) {
    return true;
  }
  return false;
}

/**
 * Update an existing account profile
 */
export function updateAccount(id: string, updates: Partial<AuthUser>): AuthUser | null {
  const accounts = getAllAccounts();
  const idx = accounts.findIndex((a) => a.id === id || a.email.toLowerCase() === id.toLowerCase());
  if (idx === -1) return null;

  // Handle email change and password migration
  if (updates.email && accounts[idx].email.toLowerCase() !== updates.email.toLowerCase()) {
    const oldEmail = accounts[idx].email.toLowerCase().trim();
    const newEmail = updates.email.toLowerCase().trim();
    if (memoryPasswords.has(oldEmail)) {
      const pwd = memoryPasswords.get(oldEmail)!;
      memoryPasswords.delete(oldEmail);
      memoryPasswords.set(newEmail, pwd);
    }
  }

  accounts[idx] = { ...accounts[idx], ...updates };

  // Also update any active session memory for this user
  for (const [sId, sess] of memorySessions.entries()) {
    if (sess.user.id === accounts[idx].id || sess.user.email.toLowerCase() === accounts[idx].email.toLowerCase()) {
      sess.user = { ...sess.user, ...updates };
    }
  }

  // Update MySQL database if connected
  try {
    const dbUpdates: any = {};
    if (updates.fullName) dbUpdates.fullName = updates.fullName;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.phone) dbUpdates.phone = updates.phone;
    if (updates.companyName) dbUpdates.companyName = updates.companyName;
    if (updates.address) dbUpdates.address = updates.address;
    if (updates.binNumber) dbUpdates.binNumber = updates.binNumber;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.role) dbUpdates.role = updates.role;
    if (Object.keys(dbUpdates).length > 0) {
      db.update(schema.users).set(dbUpdates).where(eq(schema.users.id, accounts[idx].id)).catch(() => {});
    }
  } catch {}

  saveAuthStore();
  return accounts[idx];
}

/**
 * Update an account password in memory and persistent auth store
 */
export function updateAccountPassword(email: string, newPassword: string): void {
  const normalized = email.toLowerCase().trim();
  memoryPasswords.set(normalized, newPassword);
  saveAuthStore();
}

/**
 * Find an account by ID or email
 */
export function findAccountById(id: string): AuthUser | null {
  const accounts = getAllAccounts();
  return accounts.find((a) => a.id === id || a.email.toLowerCase() === id.toLowerCase()) || null;
}

/**
 * Delete or remove an account from memory
 */
export function deleteAccount(id: string): boolean {
  const accounts = getAllAccounts();
  const idx = accounts.findIndex((a) => a.id === id || a.email.toLowerCase() === id.toLowerCase());
  if (idx === -1) return false;
  const removedUser = accounts[idx];
  accounts.splice(idx, 1);
  // Also clean up any active sessions for this user
  for (const [sId, sess] of memorySessions.entries()) {
    if (sess.user.id === removedUser.id || sess.user.email.toLowerCase() === removedUser.email.toLowerCase()) {
      memorySessions.delete(sId);
    }
  }
  saveAuthStore();
  return true;
}

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a plain text password with salt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a plain text password against a bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Look up an account by email, checking MySQL database first, with fallback to predefined accounts
 */
export async function findAccountByEmail(email: string): Promise<AuthUser | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Query MySQL database users table if reachable
  try {
    const dbUsers = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.users.role,
        status: schema.users.status,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (dbUsers.length > 0) {
      const u = dbUsers[0];
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role as UserRole,
        status: u.status,
        avatarUrl: u.avatarUrl,
      };
    }
  } catch {
    // Database may be offline during zero-config development; continue to in-memory store
  }

  // 2. Query in-memory user store
  const inMemory = getAllAccounts().find((a) => a.email.toLowerCase() === normalizedEmail);
  return inMemory || null;
}

/**
 * Create a new user session and persist to database and memory cache
 */
export async function createSession(
  user: AuthUser,
  userAgent?: string,
  ipAddress?: string
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = generateSessionId();
  // 30 days session validity
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const sessionData: SessionData = {
    sessionId,
    user,
    expiresAt,
  };

  // Immediate fast cache & disk persistence
  memorySessions.set(sessionId, sessionData);
  saveAuthStore();

  // Database session synchronization (if MySQL is running)
  try {
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt: expiresAt,
    });
  } catch {
    // Graceful offline fallback
  }

  return { sessionId, expiresAt };
}

/**
 * Validate an incoming session ID against memory cache, persistent disk store, and MySQL database
 */
export async function validateSession(sessionId: string): Promise<SessionData | null> {
  if (!sessionId) return null;

  // 1. Check in-memory fast cache
  let cached = memorySessions.get(sessionId);
  if (!cached) {
    // Check disk store in case server rebooted or module reloaded
    loadAuthStore();
    cached = memorySessions.get(sessionId);
  }

  if (cached) {
    if (cached.expiresAt.getTime() < Date.now()) {
      memorySessions.delete(sessionId);
      saveAuthStore();
      try {
        await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
      } catch {}
      return null;
    }
    return cached;
  }

  // 2. Query database sessions table if not in local node memory (multi-instance / restarted server)
  try {
    const dbSessions = await db
      .select({
        sessionId: schema.sessions.id,
        expiresAt: schema.sessions.expiresAt,
        userId: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        role: schema.users.role,
        status: schema.users.status,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(eq(schema.sessions.id, sessionId))
      .limit(1);

    if (dbSessions.length > 0) {
      const row = dbSessions[0];
      if (new Date(row.expiresAt).getTime() < Date.now()) {
        await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
        return null;
      }

      const restoredSession: SessionData = {
        sessionId: row.sessionId,
        expiresAt: new Date(row.expiresAt),
        user: {
          id: row.userId,
          email: row.email,
          fullName: row.fullName,
          role: row.role as UserRole,
          status: row.status,
          avatarUrl: row.avatarUrl,
        },
      };

      // Populate local memory cache and persistent disk store
      memorySessions.set(sessionId, restoredSession);
      saveAuthStore();
      return restoredSession;
    }
  } catch {
    // Database offline or query error
  }

  return null;
}

/**
 * Invalidate a session (Logout) from memory, persistent store, and MySQL database
 */
export async function destroySession(sessionId: string): Promise<void> {
  memorySessions.delete(sessionId);
  saveAuthStore();
  try {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
  } catch {}
}

/**
 * Role-Based Access Control permissions matrix
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: [
    'shipments:read', 'shipments:create', 'shipments:update', 'shipments:delete',
    'quotes:read', 'quotes:price', 'quotes:approve', 'quotes:delete',
    'tracking:update', 'tracking:events',
    'warehouses:manage',
    'users:manage', 'staff:manage', 'customers:manage',
    'reports:view', 'reports:export',
    'settings:update', 'audit:view'
  ],
  ops_manager: [
    'shipments:read', 'shipments:create', 'shipments:update',
    'quotes:read', 'quotes:price', 'quotes:approve',
    'tracking:update', 'tracking:events',
    'warehouses:manage',
    'customers:manage',
    'reports:view',
    'audit:view'
  ],
  warehouse_staff: [
    'shipments:read', 'shipments:update',
    'tracking:events',
    'warehouses:read',
    'receiving:process', 'dispatch:process'
  ],
  sales_team: [
    'shipments:read',
    'quotes:read', 'quotes:price', 'quotes:create',
    'customers:read', 'customers:manage'
  ],
  support_agent: [
    'shipments:read',
    'tracking:events',
    'quotes:read',
    'customers:read'
  ],
  customer: [
    'customer:shipments:read',
    'customer:quotes:create', 'customer:quotes:read', 'customer:quotes:accept',
    'customer:documents:read',
    'customer:profile:manage'
  ]
};

/**
 * Verify if role possesses specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  if (role === 'super_admin') return true;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Default mock admin and customer accounts for immediate development & staging access
 */
export const DEFAULT_ACCOUNTS = [
  {
    id: 'usr-admin-01',
    email: 'admin@goshipping.com',
    fullName: 'Operations Director',
    role: 'super_admin' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-jit-01',
    email: 'mail.jitsaha@gmail.com',
    fullName: 'JIT KUMAR SAHA',
    role: 'super_admin' as UserRole,
    status: 'active',
    phone: '+8801601111994',
    companyName: 'Dynime LLC',
    address: 'Flat 2/B, 16, 16/1 Basubazar Lane , Dayaganj'
  },
  {
    id: 'usr-ops-01',
    email: 'ops@goshipping.com',
    fullName: 'Kamal Hossain',
    role: 'ops_manager' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-warehouse-01',
    email: 'warehouse@goshipping.com',
    fullName: 'Dhaka Hub Officer',
    role: 'warehouse_staff' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-sales-01',
    email: 'sales@goshipping.com',
    fullName: 'Nafis Chowdhury',
    role: 'sales_team' as UserRole,
    status: 'active'
  },
  {
    id: 'usr-customer-01',
    email: 'client@apextextiles.com',
    fullName: 'Apex Textiles Ltd',
    role: 'customer' as UserRole,
    status: 'active',
    companyName: 'Apex Textiles Ltd',
    phone: '+880 1711 000000',
    address: 'Export Processing Zone, Savar, Dhaka 1349, Bangladesh',
    binNumber: '002918291-0102'
  }
];

/**
 * Password Reset OTP Helper Methods
 */
export function setPasswordResetOtp(email: string, code: string, ttlMs = 15 * 60 * 1000): void {
  const normalized = email.toLowerCase().trim();
  memoryOtps.set(normalized, {
    code: code.trim(),
    expiresAt: Date.now() + ttlMs
  });
}

export function getPasswordResetOtp(email: string): string | null {
  const normalized = email.toLowerCase().trim();
  const entry = memoryOtps.get(normalized);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryOtps.delete(normalized);
    return null;
  }
  return entry.code;
}

export function verifyPasswordResetOtp(email: string, code: string): boolean {
  const normalized = email.toLowerCase().trim();
  const entry = memoryOtps.get(normalized);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    memoryOtps.delete(normalized);
    return false;
  }
  if (entry.code === code.trim()) {
    memoryOtps.delete(normalized);
    return true;
  }
  return false;
}

export function clearPasswordResetOtp(email: string): void {
  memoryOtps.delete(email.toLowerCase().trim());
}

// Initial load on startup after DEFAULT_ACCOUNTS is defined
loadAuthStore();

// Pre-seed default passwords if not present in persistent store
if (!memoryPasswords.has('mail.jitsaha@gmail.com')) {
  memoryPasswords.set('mail.jitsaha@gmail.com', '123456');
}
if (!memoryPasswords.has('admin@goshipping.com')) {
  memoryPasswords.set('admin@goshipping.com', 'password');
}
