import { PrismaClient, NatureCompte, Devise, ProprietaireType, StatutCompte } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding plan comptable SYSCOHADA...');

  const planData: Array<{ numero: string; libelle: string; nature: NatureCompte }> = [
    { numero: '1010', libelle: 'Capital / Parts sociales', nature: NatureCompte.PASSIF },
    { numero: '4111', libelle: 'Membres débiteurs - Crédits ordinaires', nature: NatureCompte.ACTIF },
    { numero: '4621', libelle: "Dépôts d’épargne libre des membres", nature: NatureCompte.PASSIF },
    { numero: '4622', libelle: 'Dépôts à terme des membres', nature: NatureCompte.PASSIF },
    { numero: '4630', libelle: 'Opérations en commun et débiteurs divers', nature: NatureCompte.ACTIF },
    { numero: '5211', libelle: 'Banques locales', nature: NatureCompte.ACTIF },
    { numero: '5711', libelle: 'Caisse Centrale / Guichet (FC)', nature: NatureCompte.ACTIF },
    { numero: '5712', libelle: 'Caisse Centrale / Guichet (USD)', nature: NatureCompte.ACTIF },
    { numero: '7061', libelle: "Droits et frais d’adhésion", nature: NatureCompte.PRODUIT },
    { numero: '7062', libelle: 'Frais de gestion et abonnements', nature: NatureCompte.PRODUIT },
    { numero: '7063', libelle: 'Frais et commissions sur retraits', nature: NatureCompte.PRODUIT },
    { numero: '7064', libelle: 'Commissions sur dossiers de crédit', nature: NatureCompte.PRODUIT },
    { numero: '7711', libelle: 'Intérêts perçus sur crédits', nature: NatureCompte.PRODUIT },
    { numero: '7660', libelle: 'Gains de change', nature: NatureCompte.PRODUIT },
    { numero: '6660', libelle: 'Pertes de change', nature: NatureCompte.CHARGE },
  ];

  for (const plan of planData) {
    await prisma.planComptable.upsert({
      where: { numero: plan.numero },
      update: { libelle: plan.libelle, nature: plan.nature, estActif: true },
      create: { ...plan, estAuxiliaire: false, estActif: true },
    });
  }

  // L’ancien numéro reste inactif pour ne pas casser les écritures historiques.
  await prisma.planComptable.updateMany({
    where: { numero: '771x' },
    data: { libelle: 'Ancien compte intérêts (remplacé par 7711)', estActif: false },
  });

  const codes = [
    { code: 'MW-PRI', libelle: 'PRINCIPAL' },
    { code: 'MW-BIA', libelle: 'BIASHARA' },
    { code: 'MW-KEL', libelle: 'KELASI' },
    { code: 'MW-NYU', libelle: 'NYUMBA' },
    { code: 'MW-HOP', libelle: 'HOPITAL' },
    { code: 'MW-MUT', libelle: 'MUTOTO' },
    { code: 'MW-GEN', libelle: 'Charges communes / Général' },
  ];
  for (const code of codes) {
    await prisma.codeAnalytique.upsert({
      where: { code: code.code },
      update: { libelle: code.libelle, actif: true },
      create: { ...code, actif: true },
    });
  }

  const plans = new Map<string, number>();
  for (const plan of planData) {
    const saved = await prisma.planComptable.findUniqueOrThrow({ where: { numero: plan.numero } });
    plans.set(plan.numero, saved.id);
  }

  const accounts: Array<{ numeroCompte: string; plan: string; devise: Devise }> = [
    { numeroCompte: 'GEN-5211-BANQUE-FC', plan: '5211', devise: Devise.FC },
    { numeroCompte: 'GEN-5711-CAISSE-FC', plan: '5711', devise: Devise.FC },
    { numeroCompte: 'GEN-5712-CAISSE-USD', plan: '5712', devise: Devise.USD },
    { numeroCompte: 'GEN-4621-EPARGNE-FC', plan: '4621', devise: Devise.FC },
    { numeroCompte: 'GEN-4621-EPARGNE-USD', plan: '4621', devise: Devise.USD },
    { numeroCompte: 'GEN-4622-DAT-FC', plan: '4622', devise: Devise.FC },
    { numeroCompte: 'GEN-4622-DAT-USD', plan: '4622', devise: Devise.USD },
    { numeroCompte: 'GEN-4111-CREDITS-FC', plan: '4111', devise: Devise.FC },
    { numeroCompte: 'GEN-4111-CREDITS-USD', plan: '4111', devise: Devise.USD },
    { numeroCompte: 'GEN-4630-TRANSITOIRE-FC', plan: '4630', devise: Devise.FC },
    { numeroCompte: 'GEN-4630-TRANSITOIRE-USD', plan: '4630', devise: Devise.USD },
    { numeroCompte: 'GEN-7061-DROITS-ADHESION-FC', plan: '7061', devise: Devise.FC },
    { numeroCompte: 'GEN-7061-DROITS-ADHESION-USD', plan: '7061', devise: Devise.USD },
    { numeroCompte: 'GEN-7062-ABONNEMENTS-FC', plan: '7062', devise: Devise.FC },
    { numeroCompte: 'GEN-7062-ABONNEMENTS-USD', plan: '7062', devise: Devise.USD },
    { numeroCompte: 'GEN-7063-FRAIS-RETRAIT-FC', plan: '7063', devise: Devise.FC },
    { numeroCompte: 'GEN-7063-FRAIS-RETRAIT-USD', plan: '7063', devise: Devise.USD },
    { numeroCompte: 'GEN-7064-COMMISSIONS-CREDIT-FC', plan: '7064', devise: Devise.FC },
    { numeroCompte: 'GEN-7064-COMMISSIONS-CREDIT-USD', plan: '7064', devise: Devise.USD },
    { numeroCompte: 'GEN-7711-INTERETS-CREDITS-FC', plan: '7711', devise: Devise.FC },
    { numeroCompte: 'GEN-7711-INTERETS-CREDITS-USD', plan: '7711', devise: Devise.USD },
    { numeroCompte: 'GEN-7660-GAINS-CHANGE-FC', plan: '7660', devise: Devise.FC },
    { numeroCompte: 'GEN-6660-PERTES-CHANGE-FC', plan: '6660', devise: Devise.FC },
  ];

  for (const account of accounts) {
    await prisma.compte.upsert({
      where: { numeroCompte: account.numeroCompte },
      update: { planCompteId: plans.get(account.plan)!, devise: account.devise, statut: StatutCompte.ACTIF },
      create: {
        numeroCompte: account.numeroCompte,
        planCompteId: plans.get(account.plan)!,
        proprietaireType: ProprietaireType.SYSTEME,
        estSysteme: true,
        devise: account.devise,
        estAuxiliaire: false,
        statut: StatutCompte.ACTIF,
      },
    });
  }

  await prisma.compte.updateMany({
    where: { numeroCompte: 'GEN-771X-INTERETS-CREDITS' },
    data: { statut: StatutCompte.SUSPENDU },
  });

  console.log('Seed comptable terminé.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
