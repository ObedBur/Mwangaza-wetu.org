'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MonEpargneRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/accueil');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
