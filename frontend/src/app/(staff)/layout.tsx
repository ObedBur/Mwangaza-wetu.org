'use client';

import React from 'react';
import { CooperativePageLayout } from '@/components/cooperative/CooperativePageLayout';
import { RoleRouteGuard } from '@/components/auth/role-route-guard';

const STAFF_ROLES = ['admin', 'superadmin', 'agent'] as const;
const STAFF_ROLE_REDIRECTS = { member: '/accueil' } as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleRouteGuard
      allowedRoles={[...STAFF_ROLES]}
      roleRedirects={STAFF_ROLE_REDIRECTS}
    >
      <CooperativePageLayout>{children}</CooperativePageLayout>
    </RoleRouteGuard>
  );
}
