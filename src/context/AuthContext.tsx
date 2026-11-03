import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get, post, session } from '../api/client';

export interface SessionUser {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  platformRole: 'SUPER_ADMIN' | 'SUPPORT' | null;
  language: 'en' | 'hi';
}

export interface MembershipSummary {
  role: 'OWNER' | 'ADMIN' | 'SALESMAN' | 'ACCOUNTANT';
  business: { _id: string; name: string; tradeName?: string; gstin?: string; stateCode: string; planId: string; status: string };
}

interface Profile {
  user: SessionUser;
  businesses: MembershipSummary[];
}

interface AuthContextType {
  status: 'loading' | 'anonymous' | 'authenticated';
  user: SessionUser | null;
  memberships: MembershipSummary[];
  activeBusinessId: string | null;
  isPlatformAdmin: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<{ devCode?: string }>;
  verifyOtp: (phone: string, code: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  selectBusiness: (id: string) => void;
  createBusiness: (input: Record<string, unknown>) => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthContextType['status']>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(session.businessId());

  const applyProfile = useCallback((p: Profile) => {
    setProfile(p);
    setStatus('authenticated');
    const ids = p.businesses.map(m => m.business._id);
    // keep the remembered business if the user still belongs to it, else pick the first one
    const keep = session.businessId();
    const next = keep && ids.includes(keep) ? keep : ids[0] ?? null;
    session.setBusinessId(next);
    setActiveBusinessId(next);
  }, []);

  const reloadProfile = useCallback(async () => {
    applyProfile(await get<Profile>('/api/auth/me'));
  }, [applyProfile]);

  // restore the session after a reload
  useEffect(() => {
    session.onExpired(() => {
      setProfile(null);
      setStatus('anonymous');
    });
    if (!session.hasRefreshToken()) {
      setStatus('anonymous');
      return;
    }
    reloadProfile().catch(() => {
      session.clear();
      setStatus('anonymous');
    });
  }, [reloadProfile]);

  const finishLogin = (body: Profile & { accessToken: string; refreshToken: string }) => {
    session.setTokens(body.accessToken, body.refreshToken);
    applyProfile({ user: body.user, businesses: body.businesses });
  };

  const value: AuthContextType = {
    status,
    user: profile?.user ?? null,
    memberships: profile?.businesses ?? [],
    activeBusinessId,
    isPlatformAdmin: !!profile?.user.platformRole,
    async loginWithEmail(email, password) {
      finishLogin(await post('/api/auth/login', { email, password }));
    },
    async requestOtp(phone) {
      return post<{ devCode?: string }>('/api/auth/otp/request', { phone });
    },
    async verifyOtp(phone, code, name) {
      finishLogin(await post('/api/auth/otp/verify', { phone, code, name: name || undefined }));
    },
    async logout() {
      const token = session.refreshToken();
      if (token) await post('/api/auth/logout', { refreshToken: token }).catch(() => undefined);
      session.clear();
      session.setBusinessId(null);
      setProfile(null);
      setStatus('anonymous');
    },
    selectBusiness(id) {
      session.setBusinessId(id);
      setActiveBusinessId(id);
    },
    async createBusiness(input) {
      const b = await post<{ _id: string }>('/api/businesses', input);
      session.setBusinessId(b._id);
      await reloadProfile();
    },
    reloadProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

