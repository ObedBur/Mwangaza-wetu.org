import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Devise, NatureCompte, Prisma, SensEcriture, StatutOperation, TypeOperationComptable } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ComptabiliteReportingService {
  constructor(private readonly prisma: PrismaService) {}

  private period(debut?: string, fin?: string) {
    const dateOperation: Prisma.DateTimeFilter = {};
    const parseDate = (value: string, field: string) => {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException(`Le filtre « ${field} » doit être une date AAAA-MM-JJ valide.`);
      }
      return parsed;
    };
    const start = debut ? parseDate(debut, 'debut') : undefined;
    const end = fin ? parseDate(fin, 'fin') : undefined;
    if (start && end && start > end) {
      throw new BadRequestException('La date de fin doit être égale ou postérieure à la date de début.');
    }
    if (start && end && end.getTime() - start.getTime() > 366 * 5 * 86_400_000) {
      throw new BadRequestException('La période ne peut pas dépasser cinq ans.');
    }
    if (start) dateOperation.gte = start;
    if (end) {
      const endExclusive = new Date(end);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      dateOperation.lt = endExclusive;
    }
    return Object.keys(dateOperation).length ? dateOperation : undefined;
  }

  async journal(filters: { debut?: string; fin?: string; section?: string; type?: string; compteId?: string; devise?: string; statut?: string; page?: string; pageSize?: string }) {
    const parseDate = (value: string | undefined, name: string) => {
      if (!value) return undefined;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException(`Le filtre « ${name} » doit être une date AAAA-MM-JJ valide.`);
      }
      return value;
    };
    const debut = parseDate(filters.debut, 'debut');
    const fin = parseDate(filters.fin, 'fin');
    if (debut && fin && debut > fin) throw new BadRequestException('La date de fin doit être égale ou postérieure à la date de début.');
    const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(filters.pageSize || '50', 10) || 50));
    if (filters.devise && !Object.values(Devise).includes(filters.devise as Devise)) throw new BadRequestException('La devise doit être FC ou USD.');
    if (filters.type && !Object.values(TypeOperationComptable).includes(filters.type as TypeOperationComptable)) throw new BadRequestException('Type d’écriture comptable invalide.');
    if (filters.statut && !Object.values(StatutOperation).includes(filters.statut as StatutOperation)) throw new BadRequestException('Statut d’opération invalide.');
    const compteId = filters.compteId ? Number.parseInt(filters.compteId, 10) : undefined;
    if (filters.compteId && (!Number.isInteger(compteId) || compteId! < 1)) throw new BadRequestException('Le compte doit être un identifiant positif.');

    const where: Prisma.EcritureComptableWhereInput = {
      ...(filters.devise ? { devise: filters.devise as Devise } : {}),
      ...(compteId ? { compteId } : {}),
      operation: {
        statut: filters.statut ? filters.statut as StatutOperation : { in: [StatutOperation.VALIDEE, StatutOperation.ANNULEE] },
        dateOperation: this.period(debut, fin),
        ...(filters.type ? { typeOperation: filters.type as TypeOperationComptable } : {}),
        ...(filters.section ? { codeAnalytique: { code: filters.section } } : {}),
      },
    };
    const [lines, total, groupedTotals] = await Promise.all([this.prisma.ecritureComptable.findMany({
      where,
      include: { compte: { include: { planCompte: true } }, operation: { include: { codeAnalytique: true } } },
      orderBy: [{ operation: { dateOperation: 'desc' } }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }), this.prisma.ecritureComptable.count({ where }), this.prisma.ecritureComptable.groupBy({ by: ['devise', 'sens'], where, _sum: { montant: true } })]);

    const data = lines.map((line) => ({
      id: line.id.toString(),
      reference: line.operation.reference,
      date: line.operation.dateOperation,
      libelle: line.libelle,
      section: line.operation.codeAnalytique?.code ?? null,
      statut: line.operation.statut,
      type: line.operation.typeOperation,
      compte: { id: line.compteId, numero: line.compte.numeroCompte, libelle: line.compte.planCompte.libelle },
      devise: line.devise,
      debit: line.sens === SensEcriture.DEBIT ? Number(line.montant) : 0,
      credit: line.sens === SensEcriture.CREDIT ? Number(line.montant) : 0,
    }));
    const totaux = Object.fromEntries([Devise.FC, Devise.USD].map((devise) => [devise, {
      debit: Number(groupedTotals.find((row) => row.devise === devise && row.sens === SensEcriture.DEBIT)?._sum.montant ?? 0),
      credit: Number(groupedTotals.find((row) => row.devise === devise && row.sens === SensEcriture.CREDIT)?._sum.montant ?? 0),
    }]));
    return { data, totaux, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async rapprochementCaisse(filters: { debut?: string; fin?: string; devise?: string; agentId?: string; guichet?: string; page?: string; pageSize?: string }) {
    const validDate = (value: string | undefined, name: string) => {
      if (!value) return undefined;
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException(`Le filtre « ${name} » doit être une date AAAA-MM-JJ valide.`);
      }
      return value;
    };
    const debut = validDate(filters.debut, 'debut');
    const fin = validDate(filters.fin, 'fin');
    if (!debut || !fin) throw new BadRequestException('Les dates de début et de fin sont obligatoires pour rapprocher la caisse.');
    if (debut && fin && debut > fin) throw new BadRequestException('La date de fin doit être égale ou postérieure à la date de début.');
    if (Math.ceil((new Date(`${fin}T00:00:00.000Z`).getTime() - new Date(`${debut}T00:00:00.000Z`).getTime()) / 86_400_000) > 366 * 5) throw new BadRequestException('La période de rapprochement ne peut pas dépasser cinq ans.');
    if (filters.devise && !Object.values(Devise).includes(filters.devise as Devise)) throw new BadRequestException('La devise doit être FC ou USD.');
    const agentId = filters.agentId ? Number.parseInt(filters.agentId, 10) : undefined;
    if (filters.agentId && (!Number.isInteger(agentId) || agentId! < 1)) throw new BadRequestException('L’agent doit être un identifiant positif.');
    const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(filters.pageSize || '50', 10) || 50));
    const createdAt = this.period(debut, fin);
    const where: Prisma.MouvementCaisseAgentWhereInput = {
      createdAt,
      ...(filters.devise ? { devise: filters.devise as Devise } : {}),
      caisse: {
        ...(agentId ? { agentId } : {}),
        ...(filters.guichet ? { agent: { guichetAssigne: { contains: filters.guichet, mode: 'insensitive' } } } : {}),
      },
    };
    let failedAgentIds: number[] | undefined;
    if (filters.guichet) {
      const agents = await this.prisma.agent.findMany({ where: { guichetAssigne: { contains: filters.guichet, mode: 'insensitive' } }, select: { id: true } });
      failedAgentIds = agents.map((agent) => agent.id);
    }
    const [movements, total, groups, failedWithdrawals] = await Promise.all([
      this.prisma.mouvementCaisseAgent.findMany({
        where,
        include: { caisse: { include: { agent: { select: { id: true, nom: true, guichetAssigne: true } } } }, retrait: { select: { id: true, reference: true, statut: true, annuleLe: true, montant: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.mouvementCaisseAgent.count({ where }),
      this.prisma.mouvementCaisseAgent.groupBy({ by: ['caisseId', 'devise', 'type'], where, _sum: { montant: true } }),
      this.prisma.retrait.count({ where: {
        statut: 'FAILED', dateOperation: this.period(debut, fin),
        ...(filters.devise ? { devise: filters.devise as Devise } : {}),
        ...(agentId ? { executeParId: agentId } : failedAgentIds ? { executeParId: { in: failedAgentIds } } : {}),
      } }),
    ]);
    const epargneIds = movements.map((movement) => movement.epargneId).filter((id): id is number => id !== null);
    const remboursementIds = movements.map((movement) => movement.remboursementId).filter((id): id is number => id !== null);
    const epargnesSources = epargneIds.length
      ? await this.prisma.epargne.findMany({ where: { id: { in: epargneIds } }, select: { id: true, montant: true, devise: true } })
      : [];
    const remboursementSources = remboursementIds.length
      ? await this.prisma.remboursement.findMany({ where: { id: { in: remboursementIds } }, select: { id: true, montant: true, devise: true, deletedAt: true } })
      : [];
    const epargneById = new Map(epargnesSources.map((source) => [source.id, source]));
    const remboursementById = new Map(remboursementSources.map((source) => [source.id, source]));
    const cashboxIds = [...new Set(groups.map((group) => group.caisseId))];
    const reconciliations = await Promise.all(cashboxIds.flatMap((caisseId) => ([Devise.FC, Devise.USD].map(async (devise) => {
      const matching = groups.filter((group) => group.caisseId === caisseId && group.devise === devise);
      if (!matching.length) return null;
      const periodFilter = { ...where, caisseId, devise };
      const [first, last] = await Promise.all([
        this.prisma.mouvementCaisseAgent.findFirst({ where: periodFilter, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { soldeAvant: true } }),
        this.prisma.mouvementCaisseAgent.findFirst({ where: periodFilter, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { soldeApres: true } }),
      ]);
      const totalsByType = Object.fromEntries(matching.map((group) => [group.type, Number(group._sum.montant ?? 0)]));
      const inflows = Object.entries(totalsByType).filter(([type]) => ['DEPOT', 'REMBOURSEMENT_CREDIT', 'ANNULATION'].includes(type)).reduce((sum, [, amount]) => sum + amount, 0);
      const outflows = Object.entries(totalsByType).filter(([type]) => ['RETRAIT', 'ANNULATION_REMBOURSEMENT'].includes(type)).reduce((sum, [, amount]) => sum + amount, 0);
      const opening = Number(first?.soldeAvant ?? 0);
      const closing = Number(last?.soldeApres ?? 0);
      const expectedClosing = opening + inflows - outflows;
      return { caisseId, devise, opening, closing, inflows, outflows, ecart: Math.round((closing - expectedClosing) * 100) / 100, mouvementsParType: totalsByType };
    }))));
    return {
      data: movements.map((movement) => ({
        id: movement.id, date: movement.createdAt, type: movement.type, devise: movement.devise,
        montant: Number(movement.montant), soldeAvant: Number(movement.soldeAvant), soldeApres: Number(movement.soldeApres),
        motif: movement.motif, caisseId: movement.caisseId,
        agent: movement.caisse.agent,
        source: movement.retrait ? {
          type: 'retrait', reference: movement.retrait.reference, statut: movement.retrait.statut,
          annuleLe: movement.retrait.annuleLe, ecartMontant: Math.round((Number(movement.montant) - Number(movement.retrait.montant ?? movement.montant)) * 100) / 100,
        } : movement.remboursementId ? (() => {
          const source = remboursementById.get(movement.remboursementId!);
          return { type: 'remboursement', id: movement.remboursementId, statut: !source ? 'SOURCE INTROUVABLE' : source.deletedAt ? 'ANNULE' : 'EFFECTUE', ecartMontant: source ? Math.round((Number(movement.montant) - Number(source.montant)) * 100) / 100 : null };
        })() : movement.epargneId ? (() => {
          const source = epargneById.get(movement.epargneId!);
          return { type: 'epargne', id: movement.epargneId, statut: !source ? 'SOURCE SUPPRIMEE' : 'EFFECTUE', ecartMontant: source ? Math.round((Number(movement.montant) - Number(source.montant)) * 100) / 100 : null };
        })() : null,
      })),
      rapprochement: reconciliations.filter(Boolean),
      operationsSansMouvement: { retraitsEchoues: failedWithdrawals },
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
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

  async balance(filters: { debut?: string; fin?: string; section?: string }) {
    const rows = await this.prisma.ecritureComptable.groupBy({
      by: ['compteId', 'devise', 'sens'],
      where: {
        operation: {
          statut: StatutOperation.VALIDEE,
          dateOperation: this.period(filters.debut, filters.fin),
          ...(filters.section ? { codeAnalytique: { code: filters.section } } : {}),
        },
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
        compte: { planCompte: { nature: NatureCompte.CHARGE } },
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
        compte: { planCompte: { nature: NatureCompte.PRODUIT } },
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
