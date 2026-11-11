import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CircleHelp, LockKeyhole, Phone, ShieldCheck } from 'lucide-react';
import { MWANGAZA_BRAND } from '@/lib/theme-constants';

export const metadata: Metadata = {
  title: 'Aide à la connexion | Mwangaza Wetu',
  description: 'Trouvez votre identifiant et les étapes à suivre pour retrouver l’accès à votre espace Mwangaza Wetu.',
};

const profiles = [
  {
    number: '01',
    title: 'Membre',
    description: 'Saisissez votre numéro de compte, par exemple MW-PRI-XXXXXX, ou l’adresse e-mail associée à votre compte.',
  },
  {
    number: '02',
    title: 'Agent de guichet',
    description: 'Utilisez l’adresse e-mail ou le numéro de téléphone enregistré par votre administrateur.',
  },
  {
    number: '03',
    title: 'Administrateur',
    description: 'Utilisez votre adresse e-mail ou votre identifiant administrateur.',
  },
];

const questions = [
  {
    question: 'Où trouver mon numéro de compte membre ?',
    answer: 'Il figure sur votre carte de membre et vos documents de la coopérative. Si vous ne le retrouvez pas, appelez l’assistance ou contactez votre agence.',
  },
  {
    question: 'J’ai oublié mon mot de passe. Que faire ?',
    answer: 'La récupération automatique n’est pas disponible sur cette page. Contactez votre agence ou votre administrateur pour vérifier votre compte et rétablir votre accès.',
  },
  {
    question: 'Mon numéro de téléphone ou mon e-mail n’est pas reconnu.',
    answer: 'La connexion utilise les coordonnées enregistrées dans votre dossier. Contactez votre agence ou votre administrateur pour les vérifier ou les mettre à jour.',
  },
  {
    question: 'La connexion est temporairement bloquée après plusieurs essais.',
    answer: 'Patientez un moment avant de réessayer. Si le problème continue, appelez l’assistance au numéro indiqué sur cette page.',
  },
];

export default function LoginHelpPage() {
  return (
    <main className="min-h-dvh bg-[#f5f7fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-7">
          <Link href="/login" className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B5EA8]">
            <Image src="/images/logo.png" alt="" width={38} height={38} className="object-contain" priority />
            <span className="text-sm font-bold tracking-tight">{MWANGAZA_BRAND.name}</span>
          </Link>
          <Link href="/login" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B5EA8]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour à la connexion
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-7 sm:py-12">
        <div className="mb-8 max-w-3xl sm:mb-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0B5EA8]">Centre d’aide</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Aide à la connexion</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Retrouvez le bon identifiant et les démarches à suivre pour accéder à votre espace.
          </p>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)] lg:gap-7">
          <section aria-labelledby="identifier-help-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0B5EA8]">
                <CircleHelp className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="identifier-help-title" className="text-lg font-bold text-slate-950">Quel identifiant saisir ?</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Un seul formulaire de connexion pour tous les profils.</p>
              </div>
            </div>

            <ol className="grid gap-3">
              {profiles.map((profile) => (
                <li key={profile.number} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#0B5EA8] ring-1 ring-slate-200">
                    {profile.number}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{profile.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{profile.description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <Link href="/login" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#c65313] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#ad450d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c65313] sm:w-auto">
              Retourner au formulaire de connexion
            </Link>
          </section>

          <aside className="grid gap-5">
            <section aria-labelledby="password-help-title" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-amber-700 ring-1 ring-amber-200">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 id="password-help-title" className="text-lg font-bold text-slate-950">Mot de passe oublié ?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                La récupération automatique n’est pas disponible. Appelez l’assistance ou contactez votre agence ou votre administrateur pour rétablir votre accès.
              </p>
              <a href="tel:+243820000000" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c65313] px-4 text-sm font-bold text-white transition hover:bg-[#ad450d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c65313]">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Appeler le +243 820 000 000
              </a>
            </section>

            <section aria-labelledby="security-help-title" className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <h2 id="security-help-title" className="text-sm font-bold text-slate-950">Protégez votre compte</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">Nos agents ne vous demanderont jamais votre mot de passe, votre PIN ou un code de vérification.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section aria-labelledby="common-questions-title" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mt-8 sm:p-7">
          <h2 id="common-questions-title" className="text-lg font-bold text-slate-950">Questions fréquentes</h2>
          <div className="mt-3 divide-y divide-slate-200">
            {questions.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-800 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B5EA8]">
                  {item.question}
                  <span aria-hidden="true" className="text-lg font-normal text-[#0B5EA8] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-3xl pb-1 pr-8 text-sm leading-relaxed text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-500">
          {MWANGAZA_BRAND.name} · Épargne, crédit et accompagnement
        </p>
      </div>
    </main>
  );
}
