import { PrismaClient, Devise, StatutRetrait } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ComptabiliteService } from '../src/comptabilite/comptabilite.service';
import { getSectionTrigram } from '../src/common/constants/sections';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const comptabilite = new ComptabiliteService(prisma as never);

function devise(value: string): Devise {
  if (value !== Devise.FC && value !== Devise.USD) throw new Error(`Devise non prise en charge: ${value}`);
  return value;
}

function section(typeCompte: string) {
  const code = `MW-${getSectionTrigram(typeCompte)}`;
  return ['MW-PRI', 'MW-BIA', 'MW-KEL', 'MW-NYU', 'MW-HOP', 'MW-MUT'].includes(code) ? code : 'MW-GEN';
}

async function main() {
  let migrated = 0;
  let skipped = 0;
  const report = (name: string) => {
    migrated++;
    if (migrated % 100 === 0) console.log(`${name}: ${migrated} opérations migrées...`);
  };

  const ouvertures = await prisma.mouvementCaisseAgent.findMany({
    where: { type: 'OUVERTURE' },
    orderBy: { id: 'asc' },
  });
  for (const ouverture of ouvertures) {
    const key = `legacy-agent-opening-${ouverture.id}`;
    if (await prisma.operation.findUnique({ where: { idempotencyKey: key } })) { skipped++; continue; }
    if (Number(ouverture.montant) <= 0) { skipped++; continue; }
    await prisma.$transaction((tx) => comptabilite.enregistrerOuvertureCaisse(tx, {
      montant: Number(ouverture.montant),
      devise: ouverture.devise,
      executeParId: ouverture.acteurId ?? undefined,
      executeParRole: ouverture.acteurRole ?? 'admin',
      dateOperation: ouverture.createdAt,
      idempotencyKey: key,
      motif: ouverture.motif ?? `Ouverture caisse agent #${ouverture.caisseId}`,
    }));
    report('Ouvertures de caisse');
  }

  // Les revenus d'adhésion conservent le montant historique réellement enregistré.
  const adhesionRevenus = await prisma.revenu.findMany({
    where: { typeRevenu: { nom: 'Système Membre' } },
    include: { typeRevenu: true },
    orderBy: { id: 'asc' },
  });
  const membresFactures = new Set(adhesionRevenus.map((row) => row.sourceCompte).filter((x): x is string => Boolean(x)));
  for (const revenu of adhesionRevenus) {
    const key = `legacy-adhesion-${revenu.id}`;
    if (await prisma.operation.findUnique({ where: { idempotencyKey: key } })) { skipped++; continue; }
    await prisma.$transaction((tx) => comptabilite.enregistrerAdhesion(tx, {
      montant: Number(revenu.montant),
      devise: revenu.devise,
      codeSection: section(revenu.typeCompte),
      dateOperation: revenu.dateOperation,
      tauxChange: revenu.devise === Devise.USD ? 2500 : undefined,
      motif: `Reprise historique adhésion ${revenu.sourceCompte ?? revenu.id}`,
      idempotencyKey: key,
    }));
    report('Adhésions');
  }

  // Certaines anciennes installations n'avaient que les lignes de revenus en épargne.
  const adhEspargneLegacy = await prisma.epargne.findMany({
    where: { compte: { contains: '-REVENUS' }, description: { contains: "Frais d'adhésion" }, typeOperation: 'depot' },
    orderBy: { id: 'asc' },
  });
  for (const ligne of adhEspargneLegacy) {
    const match = ligne.description?.match(/membre\s+(.+)$/i);
    const numeroMembre = match?.[1]?.trim();
    if (!numeroMembre || membresFactures.has(numeroMembre)) { skipped++; continue; }
    const key = `legacy-adhesion-epargne-${ligne.id}`;
    if (await prisma.operation.findUnique({ where: { idempotencyKey: key } })) { skipped++; continue; }
    const analytic = ligne.compte.match(/^MW-([A-Z]{3})-REVENUS$/)?.[1];
    const analyticCode = analytic && ['BIA', 'KEL', 'NYU', 'HOP', 'MUT'].includes(analytic) ? `MW-${analytic}` : 'MW-GEN';
    await prisma.$transaction((tx) => comptabilite.enregistrerAdhesion(tx, {
      montant: Number(ligne.montant),
      devise: ligne.devise,
      codeSection: analyticCode,
      dateOperation: ligne.dateOperation,
      tauxChange: ligne.devise === Devise.USD ? 2500 : undefined,
      motif: `Reprise historique adhésion ${numeroMembre}`,
      idempotencyKey: key,
    }));
    membresFactures.add(numeroMembre);
    report('Adhésions');
  }

  // Décaissements des crédits historiques, sans recopier les pseudo-comptes de trésorerie.
  const credits = await prisma.credit.findMany({ include: { membre: true }, orderBy: { id: 'asc' } });
  for (const credit of credits) {
    const key = `legacy-credit-${credit.id}`;
    if (await prisma.operation.findUnique({ where: { idempotencyKey: key } })) { skipped++; continue; }
    await prisma.$transaction((tx) => comptabilite.enregistrerDecaissementCredit(tx, {
      montant: Number(credit.montant),
      devise: devise(credit.devise),
      numeroCompte: credit.numeroCompte,
      codeSection: section(credit.membre.typeCompte),
      dateOperation: credit.dateDebut,
      idempotencyKey: key,
    }));
    report('Décaissements');
  }

  const remboursements = await prisma.remboursement.findMany({
    where: { deletedAt: null },
    include: { credit: { include: { membre: true } }, revenus: true },
    orderBy: { id: 'asc' },
  });
  for (const remboursement of remboursements) {
    const key = remboursement.idempotencyKey ?? `legacy-remboursement-${remboursement.id}`;
    if (await prisma.operation.findUnique({ where: { idempotencyKey: key } })) { skipped++; continue; }
    const partPrincipal = Number(remboursement.partPrincipal);
    const partInteret = Number(remboursement.partInteret);
    const montant = Number(remboursement.montant);
    if (Math.abs(partPrincipal + partInteret - montant) >= 0.005) {
      console.warn(`Remboursement #${remboursement.id} ignoré: ventilation historique incohérente.`);
      skipped++;
      continue;
    }
    const revenuCoop = remboursement.revenus
      .filter((r) => Number(r.montant) > 0)
      .reduce((sum, r) => sum + Number(r.montant), 0);
    const tauxTotal = Number(remboursement.credit.tauxInteret) || 15;
    const partMembre = revenuCoop > 0
      ? Math.max(0, Math.round((partInteret - revenuCoop) * 100) / 100)
      : Math.round(partInteret * (3 / tauxTotal) * 100) / 100;
    await prisma.$transaction((tx) => comptabilite.enregistrerRemboursementCredit(tx, {
      montant,
      partPrincipal,
      partInteret,
      partMembre,
      devise: devise(remboursement.devise),
      numeroCompte: remboursement.credit.numeroCompte,
      codeSection: section(remboursement.credit.membre.typeCompte),
      executeParId: remboursement.executeParId ?? undefined,
      executeParRole: remboursement.executeParRole ?? undefined,
      dateOperation: remboursement.dateRemboursement,
      idempotencyKey: key,
    }));
    report('Remboursements');
  }

  // Dépôts non liés à un remboursement; les comptes techniques sont exclus.
  const depots = await prisma.epargne.findMany({
    where: {
      typeOperation: 'depot',
      remboursementId: null,
      NOT: { OR: [
        { compte: { contains: 'REVENUS' } }, { compte: { contains: 'SECTION-0000' } },
        { compte: { contains: 'CREDITS' } }, { compte: { contains: 'TRESORERIE' } },
      ] },
    },
    include: { membre: true },
    orderBy: { id: 'asc' },
  });
  for (const depot of depots) {
    const key = `epargne-${depot.id}`;
    if (await prisma.operation.findUnique({ where: { idempotencyKey: key } })) { skipped++; continue; }
    await prisma.$transaction((tx) => comptabilite.enregistrerDepotEpargne(tx, {
      montant: Number(depot.montant),
      devise: depot.devise,
      numeroCompte: depot.compte,
      codeSection: section(depot.membre.typeCompte),
      executeParId: depot.executeParId ?? undefined,
      executeParRole: depot.executeParRole ?? undefined,
      dateOperation: depot.dateOperation,
      idempotencyKey: key,
    }));
    report('Dépôts');
  }

  const retraits = await prisma.retrait.findMany({
    where: { statut: StatutRetrait.COMPLETED },
    include: { membre: true },
    orderBy: { id: 'asc' },
  });
  for (const retrait of retraits) {
    const key = retrait.idempotencyKey ?? `legacy-retrait-${retrait.id}`;
    if (await prisma.operation.findUnique({ where: { idempotencyKey: key } })) { skipped++; continue; }
    await prisma.$transaction((tx) => comptabilite.enregistrerRetraitEpargne(tx, {
      montant: Number(retrait.montant),
      frais: Number(retrait.frais),
      devise: retrait.devise,
      numeroCompte: retrait.compte,
      codeSection: section(retrait.membre.typeCompte),
      executeParId: retrait.executeParId ?? undefined,
      executeParRole: retrait.executeParRole ?? undefined,
      dateOperation: retrait.dateOperation,
      idempotencyKey: key,
    }));
    report('Retraits');
  }

  console.log(`Migration terminée: ${migrated} nouvelles opérations, ${skipped} ignorées (déjà reprises ou incohérentes).`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
