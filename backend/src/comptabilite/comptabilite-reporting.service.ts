import { Injectable, NotFoundException } from '@nestjs/common';
import { NatureCompte, Prisma, SensEcriture, StatutOperation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ComptabiliteReportingService {
  constructor(private readonly prisma: PrismaService) {}

  private period(debut?: string, fin?: string) {
    const dateOperation: Prisma.DateTimeFilter = {};
    if (debut) dateOperation.gte = new Date(debut);
    if (fin) {
      const end = new Date(fin);
      end.setHours(23, 59, 59, 999);
      dateOperation.lte = end;
    }
    return Object.keys(dateOperation).length ? dateOperation : undefined;
  }

  async journal(filters: { debut?: string; fin?: string; section?: string; type?: string }) {
    const operations = await this.prisma.operation.findMany({
      where: {
        statut: { in: [StatutOperation.VALIDEE, StatutOperation.ANNULEE] },
        dateOperation: this.period(filters.debut, filters.fin),
        ...(filters.type ? { typeOperation: filters.type as never } : {}),
        ...(filters.section ? { codeAnalytique: { code: filters.section } } : {}),
      },
      include: { codeAnalytique: true, ecritures: { include: { compte: { include: { planCompte: true } } } } },
      orderBy: [{ dateOperation: 'asc' }, { createdAt: 'asc' }],
    });
    return operations.map((operation) => ({
      ...operation,
      ecritures: operation.ecritures.map((ligne) => ({ ...ligne, id: ligne.id.toString() })),
    }));
  }

  async grandLivre(compteId: number, filters: { debut?: string; fin?: string }) {
    const compte = await this.prisma.compte.findUnique({
      where: { id: compteId }, include: { planCompte: true },
    });
    if (!compte) throw new NotFoundException('Compte comptable introuvable.');
    const fin = this.period(undefined, filters.fin);
    const lignes = await this.prisma.ecritureComptable.findMany({
      where: {
        compteId,
        operation: { statut: StatutOperation.VALIDEE, dateOperation: fin },
      },
      include: { operation: { include: { codeAnalytique: true } } },
      orderBy: [{ operation: { dateOperation: 'asc' } }, { createdAt: 'asc' }],
    });
    let solde = 0;
    let soldeOuverture = 0;
    const beforeStart = filters.debut ? new Date(filters.debut) : null;
    const detail = lignes.map((ligne) => {
      const montant = Number(ligne.montant);
      const sensActif = compte.planCompte.nature === NatureCompte.ACTIF || compte.planCompte.nature === NatureCompte.CHARGE;
      const variation = (ligne.sens === SensEcriture.DEBIT) === sensActif ? montant : -montant;
      solde += variation;
      if (beforeStart && ligne.operation.dateOperation < beforeStart) {
        soldeOuverture = solde;
        return null;
      }
      return {
        id: ligne.id.toString(),
        date: ligne.operation.dateOperation,
        reference: ligne.operation.reference,
        libelle: ligne.libelle,
        section: ligne.operation.codeAnalytique?.code ?? null,
        devise: ligne.devise,
        debit: ligne.sens === SensEcriture.DEBIT ? montant : 0,
        credit: ligne.sens === SensEcriture.CREDIT ? montant : 0,
        soldeProgressif: Math.round(solde * 100) / 100,
      };
    }).filter(Boolean);
    return { compte, soldeOuverture, lignes: detail, soldeCloture: solde };
  }

  async balance(filters: { debut?: string; fin?: string }) {
    const rows = await this.prisma.ecritureComptable.groupBy({
      by: ['compteId', 'devise', 'sens'],
      where: {
        operation: { statut: StatutOperation.VALIDEE, dateOperation: this.period(filters.debut, filters.fin) },
      },
      _sum: { montant: true },
    });
    const comptes = await this.prisma.compte.findMany({ include: { planCompte: true }, orderBy: { numeroCompte: 'asc' } });
    return comptes.map((compte) => {
      const devises = [...new Set(rows.filter((r) => r.compteId === compte.id).map((r) => r.devise))];
      return {
        compte,
        soldes: devises.map((devise) => {
          const debit = Number(rows.find((r) => r.compteId === compte.id && r.devise === devise && r.sens === SensEcriture.DEBIT)?._sum.montant ?? 0);
          const credit = Number(rows.find((r) => r.compteId === compte.id && r.devise === devise && r.sens === SensEcriture.CREDIT)?._sum.montant ?? 0);
          const netDebiteur = compte.planCompte.nature === NatureCompte.ACTIF || compte.planCompte.nature === NatureCompte.CHARGE;
          const soldeNet = netDebiteur ? debit - credit : credit - debit;
          return { devise, debit, credit, soldeDebiteur: Math.max(0, soldeNet), soldeCrediteur: Math.max(0, -soldeNet) };
        }),
      };
    });
  }

  async compteResultat(filters: { debut?: string; fin?: string; section?: string }) {
    const lignes = await this.prisma.ecritureComptable.findMany({
      where: {
        compte: { planCompte: { numero: { startsWith: '6' } } },
        operation: {
          statut: StatutOperation.VALIDEE,
          dateOperation: this.period(filters.debut, filters.fin),
          ...(filters.section ? { codeAnalytique: { code: filters.section } } : {}),
        },
      },
      include: { compte: { include: { planCompte: true } }, operation: { include: { codeAnalytique: true } } },
    });
    const products = await this.prisma.ecritureComptable.findMany({
      where: {
        compte: { planCompte: { numero: { startsWith: '7' } } },
        operation: {
          statut: StatutOperation.VALIDEE,
          dateOperation: this.period(filters.debut, filters.fin),
          ...(filters.section ? { codeAnalytique: { code: filters.section } } : {}),
        },
      },
      include: { compte: { include: { planCompte: true } }, operation: { include: { codeAnalytique: true } } },
    });
    const aggregate = (entries: typeof lignes) => {
      const sums = new Map<string, { compte: string; libelle: string; section: string | null; devise: string; montant: number }>();
      for (const entry of entries) {
        const isProduct = entry.compte.planCompte.nature === NatureCompte.PRODUIT;
        const montant = Number(entry.montant) * ((entry.sens === SensEcriture.CREDIT) === isProduct ? 1 : -1);
        const section = entry.operation.codeAnalytique?.code ?? null;
        const key = `${entry.compteId}|${section ?? ''}|${entry.devise}`;
        const item = sums.get(key) ?? { compte: entry.compte.numeroCompte, libelle: entry.compte.planCompte.libelle, section, devise: entry.devise, montant: 0 };
        item.montant += montant;
        sums.set(key, item);
      }
      return [...sums.values()];
    };
    const produits = aggregate(products);
    const charges = aggregate(lignes);
    const result: Record<string, { produits: number; charges: number; resultat: number }> = {};
    for (const devise of ['FC', 'USD']) {
      const produit = produits.filter((x) => x.devise === devise).reduce((s, x) => s + x.montant, 0);
      const charge = charges.filter((x) => x.devise === devise).reduce((s, x) => s + x.montant, 0);
      result[devise] = { produits: produit, charges: charge, resultat: produit - charge };
    }
    return { produits, charges, consolide: result };
  }
}
