import { PrismaClient, NatureCompte, Devise, ProprietaireType, StatutCompte } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma v7 exige un driver adapter (ici pg) pour se connecter.
// Bun charge .env automatiquement depuis le dossier courant (backend/).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding plan comptable SYSCOHADA...');

  // 1) Plan comptable
  const planData = [
    { numero: '101', libelle: "Parts sociales / Capital", nature: NatureCompte.PASSIF },
    { numero: '411', libelle: "Membres débiteurs (crédits)", nature: NatureCompte.ACTIF },
    { numero: '462', libelle: "Épargne des membres", nature: NatureCompte.PASSIF },
    { numero: '463', libelle: "Opérations en commun", nature: NatureCompte.ACTIF },
    { numero: '521', libelle: "Banques", nature: NatureCompte.ACTIF },
    { numero: '571', libelle: "Caisse", nature: NatureCompte.ACTIF },
    { numero: '7061', libelle: "Droits d’adhésion", nature: NatureCompte.PRODUIT },
    { numero: '7062', libelle: "Abonnements compte épargne", nature: NatureCompte.PRODUIT },
    { numero: '771x', libelle: "Intérêts sur crédits", nature: NatureCompte.PRODUIT },
    { numero: '766', libelle: "Gains de change", nature: NatureCompte.PRODUIT },
    { numero: '666', libelle: "Pertes de change", nature: NatureCompte.CHARGE },
  ];

  for (const p of planData) {
    await prisma.planComptable.upsert({
      where: { numero: p.numero },
      update: { libelle: p.libelle, nature: p.nature },
      create: { numero: p.numero, libelle: p.libelle, nature: p.nature, estAuxiliaire: false, estActif: true },
    });
  }

  // 2) Codes analytiques
  const codes = [
    { code: 'MW-BIA', libelle: 'BIASHARA' },
    { code: 'MW-KEL', libelle: 'KELASI' },
    { code: 'MW-NYU', libelle: 'NYUMBA' },
    { code: 'MW-HOP', libelle: 'HOPITAL' },
    { code: 'MW-MUT', libelle: 'MUTOTO' },
    { code: 'MW-GEN', libelle: 'Charges communes / Général' },
  ];

  for (const c of codes) {
    await prisma.codeAnalytique.upsert({
      where: { code: c.code },
      update: { libelle: c.libelle },
      create: { code: c.code, libelle: c.libelle, actif: true },
    });
  }

  // 3) Créer les comptes généraux pour 571,521,462,7061,7062,771x
  const getPlan = async (numero: string) => prisma.planComptable.findUniqueOrThrow({ where: { numero } });

  const p571 = await getPlan('571');
  const p521 = await getPlan('521');
  const p462 = await getPlan('462');
  const p7061 = await getPlan('7061');
  const p7062 = await getPlan('7062');
  const p771x = await getPlan('771x');

  const comptesGen = [
    { numeroCompte: 'GEN-571-CAISSE-FC', planCompteId: p571.id, proprietaireType: ProprietaireType.SYSTEME, estSysteme: true },
    { numeroCompte: 'GEN-521-BANQUE-FC', planCompteId: p521.id, proprietaireType: ProprietaireType.SYSTEME, estSysteme: true },
    { numeroCompte: 'GEN-462-EPARGNE-FC', planCompteId: p462.id, proprietaireType: ProprietaireType.SYSTEME, estSysteme: true },
    { numeroCompte: 'GEN-7061-DROITS-ADHESION', planCompteId: p7061.id, proprietaireType: ProprietaireType.SYSTEME, estSysteme: true },
    { numeroCompte: 'GEN-7062-ABONNEMENTS', planCompteId: p7062.id, proprietaireType: ProprietaireType.SYSTEME, estSysteme: true },
    { numeroCompte: 'GEN-771X-INTERETS-CREDITS', planCompteId: p771x.id, proprietaireType: ProprietaireType.SYSTEME, estSysteme: true },
  ];

  for (const c of comptesGen) {
    await prisma.compte.upsert({
      where: { numeroCompte: c.numeroCompte },
      update: {},
      create: { ...c, devise: Devise.FC, estAuxiliaire: false, statut: StatutCompte.ACTIF },
    });
  }

  console.log('Seed terminé avec succès.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
