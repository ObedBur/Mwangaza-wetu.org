'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CooperativePageLayout } from '@/components/cooperative/CooperativePageLayout';
import { getAuthToken, getAuthUser } from '@/lib/auth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Vérification de session différée d'un tick (setState en callback,
    // pas synchrone dans le corps de l'effet — règle react-hooks)
    const id = window.setTimeout(() => {
      const token = getAuthToken();
      const user = getAuthUser();
      if (!token || !user) {
        router.replace('/login');
        return;
      }
      if (user.role === 'member') {
        router.replace('/mon-epargne');
        return;
      }
      setAuthorized(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <CooperativePageLayout>{children}</CooperativePageLayout>;
}
