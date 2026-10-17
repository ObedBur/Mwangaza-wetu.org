import { redirect } from 'next/navigation';

/** Ancien favori de l’espace agent : tous les agents utilisent désormais le dashboard staff. */
export default function LegacyAgentPage() {
  redirect('/dashboard');
}
