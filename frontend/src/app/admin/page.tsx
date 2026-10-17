import { redirect } from 'next/navigation';

/** Alias historique : le layout du tableau de bord vérifie la session et le rôle. */
export default function AdminIndexPage() {
  redirect('/dashboard');
}
