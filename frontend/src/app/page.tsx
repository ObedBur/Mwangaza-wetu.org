import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getPostLoginRedirect } from '@/lib/auth';
import type { UserRole } from '@/types/auth';

const KNOWN_ROLES: UserRole[] = ['superadmin', 'admin', 'member', 'agent'];

export default async function RootPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('mwangaza_role')?.value as UserRole | undefined;

  if (role && KNOWN_ROLES.includes(role)) {
    redirect(getPostLoginRedirect(role));
  }
  redirect('/login');
}
