import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getPostLoginRedirect } from '@/lib/auth';
import type { UserRole } from '@/types/auth';
import VitrinePage from './VitrinePage';

const KNOWN_ROLES: UserRole[] = ['superadmin', 'admin', 'member', 'agent'];

export default async function RootPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('mwangaza_role')?.value as UserRole | undefined;

  // Authenticated users are redirected to their dashboard
  if (role && KNOWN_ROLES.includes(role)) {
    redirect(getPostLoginRedirect(role));
  }

  // Public visitors see the landing / vitrine page
  return <VitrinePage />;
}
