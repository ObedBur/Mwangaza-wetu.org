'use client';

import React, { useEffect, useState } from 'react';
import { MemberShell } from '@/components/member-portal/member-shell';
import { RoleRouteGuard } from '@/components/auth/role-route-guard';
import { MemberDataProvider } from '@/components/member-portal/member-data';
import '@/app/member-portal.css';

const MEMBER_ROLES = ['member'] as const;
const MEMBER_ROLE_REDIRECTS = { admin: '/dashboard', superadmin: '/dashboard', agent: '/dashboard' } as const;

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
        <div className="w-8 h-8 border-4 border-[#0b5ea8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <RoleRouteGuard
      allowedRoles={[...MEMBER_ROLES]}
      roleRedirects={MEMBER_ROLE_REDIRECTS}
    >
      <MemberDataProvider>
        <MemberShell>{children}</MemberShell>
      </MemberDataProvider>
    </RoleRouteGuard>
  );
}
