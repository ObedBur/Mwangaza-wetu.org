import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Devise, StatutCredit, TypeOperationEpargne } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private parseReportDate(value: string | undefined, field: string): Date {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`Le champ « ${field} » doit respecter le format AAAA-MM-JJ.`);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException(`La date « ${value} » n’existe pas.`);
    return date;
  }

  private requiredReportRange(debutValue?: string, finValue?: string) {
    const debut = this.parseReportDate(debutValue, 'debut');
    const fin = this.parseReportDate(finValue, 'fin');
    if (fin < debut) throw new BadRequestException('La date de fin doit être égale ou postérieure à la date de début.');
    const finExclusive = new Date(fin);
    finExclusive.setUTCDate(finExclusive.getUTCDate() + 1);
    if (finExclusive.getTime() - debut.getTime() > 366 * 5 * 86_400_000) throw new BadRequestException('La période ne peut pas dépasser cinq ans.');
    return { debut, fin, finExclusive };
  }

  /** Synthèse agrégée côté PostgreSQL : aucune liste d'opérations complète n'est envoyée au navigateur. */
  async getSynthese(filters: { debut?: string; fin?: string; granularite?: string }) {
    const parseDate = (value: string | undefined, field: string): Date => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException(`Le champ « ${field} » doit respecter le format AAAA-MM-JJ.`);
      }
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException(`La date « ${value} » n’existe pas.`);
      }
      return date;
    };

    const debut = parseDate(filters.debut, 'debut');
    const finInclusive = parseDate(filters.fin, 'fin');
    if (finInclusive < debut) {
      throw new BadRequestException('La date de fin doit être égale ou postérieure à la date de début.');
    }
    const finExclusive = new Date(finInclusive);
    finExclusive.setUTCDate(finExclusive.getUTCDate() + 1);
    const durationDays = Math.ceil((finExclusive.getTime() - debut.getTime()) / 86_400_000);
    if (durationDays > 366 * 5) {
      throw new BadRequestException('La période ne peut pas dépasser cinq ans.');
    }

    const requestedGranularity = filters.granularite;
    if (requestedGranularity && !['jour', 'semaine', 'mois'].includes(requestedGranularity)) {
      throw new BadRequestException('La granularité doit être « jour », « semaine » ou « mois ».');
    }
    const granularity = (requestedGranularity || (durationDays <= 45 ? 'jour' : durationDays <= 180 ? 'semaine' : 'mois')) as 'jour' | 'semaine' | 'mois';
    const dateTrunc = granularity === 'jour' ? 'day' : granularity === 'semaine' ? 'week' : 'month';
    const bucket = (column: Prisma.Sql) => Prisma.sql`date_trunc(${dateTrunc}, ${column})`;
    const range = (column: Prisma.Sql) => Prisma.sql`${column} >= ${debut} AND ${column} < ${finExclusive}`;

    type AmountRow = { bucket: Date; devise: string; total: Prisma.Decimal | number | string };
    type MemberRow = { bucket: Date; count: bigint | number };
    const [depots, retraits, credits, remboursements, adhesions] = await Promise.all([
      this.prisma.$queryRaw<AmountRow[]>(Prisma.sql`SELECT ${bucket(Prisma.raw('date_operation'))} AS bucket, devise::text AS devise, SUM(montant) AS total FROM epargnes WHERE ${range(Prisma.raw('date_operation'))} AND type_operation = 'depot' AND remboursement_id IS NULL AND COALESCE(description, '') NOT LIKE 'Contrepassation retrait %' AND (dat_id IS NULL OR EXISTS (SELECT 1 FROM dats d WHERE d.id = epargnes.dat_id AND d.statut <> 'ANNULE')) GROUP BY 1, 2`),
      this.prisma.$queryRaw<AmountRow[]>(Prisma.sql`SELECT ${bucket(Prisma.raw('date_operation'))} AS bucket, devise::text AS devise, SUM(montant) AS total FROM retraits WHERE ${range(Prisma.raw('date_operation'))} AND statut = 'COMPLETED' AND annule_le IS NULL GROUP BY 1, 2`),
      this.prisma.$queryRaw<AmountRow[]>(Prisma.sql`SELECT ${bucket(Prisma.raw('date_debut'))} AS bucket, devise::text AS devise, SUM(montant) AS total FROM credits WHERE ${range(Prisma.raw('date_debut'))} GROUP BY 1, 2`),
      this.prisma.$queryRaw<AmountRow[]>(Prisma.sql`SELECT ${bucket(Prisma.raw('date_remboursement'))} AS bucket, devise::text AS devise, SUM(montant) AS total FROM remboursements WHERE ${range(Prisma.raw('date_remboursement'))} AND deleted_at IS NULL GROUP BY 1, 2`),
      this.prisma.$queryRaw<MemberRow[]>(Prisma.sql`SELECT ${bucket(Prisma.raw('date_adhesion'))} AS bucket, COUNT(*)::bigint AS count FROM membres WHERE ${range(Prisma.raw('date_adhesion'))} GROUP BY 1`),
    ]);

    const amount = (value: AmountRow['total']) => Number(value ?? 0);
    const totals = {
      depots: { FC: 0, USD: 0 },
      retraits: { FC: 0, USD: 0 },
      creditsDecaisses: { FC: 0, USD: 0 },
      remboursements: { FC: 0, USD: 0 },
      adhesions: 0,
    };
    type SeriesPoint = { date: string; depots: { FC: number; USD: number }; retraits: { FC: number; USD: number }; creditsDecaisses: { FC: number; USD: number }; remboursements: { FC: number; USD: number }; adhesions: number };
    const points = new Map<string, SeriesPoint>();
    const keyOf = (date: Date) => date.toISOString().slice(0, 10);
    const addAmounts = (rows: AmountRow[], name: 'depots' | 'retraits' | 'creditsDecaisses' | 'remboursements') => {
      for (const row of rows) {
        if (row.devise !== 'FC' && row.devise !== 'USD') continue;
        const date = keyOf(new Date(row.bucket));
        const value = amount(row.total);
        totals[name][row.devise] += value;
        const point = points.get(date) ?? { date, depots: { FC: 0, USD: 0 }, retraits: { FC: 0, USD: 0 }, creditsDecaisses: { FC: 0, USD: 0 }, remboursements: { FC: 0, USD: 0 }, adhesions: 0 };
        point[name][row.devise] += value;
        points.set(date, point);
      }
    };
    addAmounts(depots, 'depots');
    addAmounts(retraits, 'retraits');
    addAmounts(credits, 'creditsDecaisses');
    addAmounts(remboursements, 'remboursements');
    for (const row of adhesions) {
      const date = keyOf(new Date(row.bucket));
      const count = Number(row.count);
      totals.adhesions += count;
      const point = points.get(date) ?? { date, depots: { FC: 0, USD: 0 }, retraits: { FC: 0, USD: 0 }, creditsDecaisses: { FC: 0, USD: 0 }, remboursements: { FC: 0, USD: 0 }, adhesions: 0 };
      point.adhesions += count;
      points.set(date, point);
    }

    return {
      periode: { debut: debut.toISOString().slice(0, 10), fin: finInclusive.toISOString().slice(0, 10), granularite: granularity },
      devises: ['FC', 'USD'],
      totaux: totals,
      serie: [...points.values()].sort((a, b) => a.date.localeCompare(b.date)),
      exclusions: { depotsRemboursement: true, retraitsAnnulesOuEchoues: true, remboursementsSupprimes: true },
    };
  }

  async getEpargneProduit(filters: { debut?: string; fin?: string }) {
    const { debut, fin, finExclusive } = this.requiredReportRange(filters.debut, filters.fin);
    const [depots, retraits, dats] = await Promise.all([
      this.prisma.$queryRaw<Array<{ produit: string; sousCompte: string; devise: string; montant: Prisma.Decimal }>>`
        SELECT m.type_compte AS produit, e.type_compte AS "sousCompte", e.devise::text AS devise, SUM(e.montant) AS montant
        FROM epargnes e JOIN membres m ON m.numero_compte = e.compte
        WHERE e.date_operation >= ${debut} AND e.date_operation < ${finExclusive}
          AND e.type_operation = 'depot' AND e.remboursement_id IS NULL
          AND COALESCE(e.description, '') NOT LIKE 'Contrepassation retrait %'
          AND (e.dat_id IS NULL OR EXISTS (SELECT 1 FROM dats d WHERE d.id = e.dat_id AND d.statut <> 'ANNULE'))
        GROUP BY m.type_compte, e.type_compte, e.devise ORDER BY m.type_compte, e.type_compte, e.devise
      `,
      this.prisma.$queryRaw<Array<{ produit: string; devise: string; montant: Prisma.Decimal }>>`
        SELECT m.type_compte AS produit, r.devise::text AS devise, SUM(r.montant) AS montant
        FROM retraits r JOIN membres m ON m.numero_compte = r.compte
        WHERE r.date_operation >= ${debut} AND r.date_operation < ${finExclusive}
          AND r.statut = 'COMPLETED' AND r.annule_le IS NULL
        GROUP BY m.type_compte, r.devise ORDER BY m.type_compte, r.devise
      `,
      this.prisma.$queryRaw<Array<{ produit: string; dureeMois: number; devise: string; statut: string; contrats: bigint; capital: Prisma.Decimal; gain: Prisma.Decimal }>>`
        SELECT m.type_compte AS produit, d.duree_mois AS "dureeMois", d.devise::text AS devise, d.statut::text AS statut,
          COUNT(*)::bigint AS contrats, SUM(d.capital) AS capital, SUM(d.gain) AS gain
        FROM dats d JOIN membres m ON m.numero_compte = d.numero_compte
        WHERE d.date_ouverture >= ${debut} AND d.date_ouverture < ${finExclusive} AND d.statut <> 'ANNULE'
        GROUP BY m.type_compte, d.duree_mois, d.devise, d.statut ORDER BY m.type_compte, d.duree_mois, d.devise, d.statut
      `,
    ]);
    return {
      periode: { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
      depots: depots.map((row) => ({ ...row, montant: Number(row.montant) })),
      retraits: retraits.map((row) => ({ ...row, montant: Number(row.montant) })),
      dats: dats.map((row) => ({ ...row, contrats: Number(row.contrats), capital: Number(row.capital), gain: Number(row.gain) })),
      note: 'Les dépôts sont des fonds appartenant aux membres et ne constituent pas un revenu de la coopérative.',
    };
  }

  async getCreditPortfolio(filters: { debut?: string; fin?: string; page?: string; pageSize?: string }) {
    const { debut, fin, finExclusive } = this.requiredReportRange(filters.debut, filters.fin);
    const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(filters.pageSize || '50', 10) || 50));
    const where = { dateDebut: { gte: debut, lt: finExclusive } };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);
    const upcomingWhere = { ...where, statut: { in: [StatutCredit.actif, StatutCredit.en_retard] }, dateEcheance: { gte: today, lte: in30Days } };
    const [credits, total, ageing, upcomingCredits] = await Promise.all([
      this.prisma.credit.findMany({
        where, include: { membre: { select: { id: true, nomComplet: true, numeroCompte: true } }, remboursements: { where: { deletedAt: null }, select: { montant: true } } },
        orderBy: [{ dateEcheance: 'asc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.credit.count({ where }),
      this.prisma.$queryRaw<Array<{ devise: string; tranche: string; montant: Prisma.Decimal; credits: bigint }>>`
        WITH paiements AS (
          SELECT credit_id, SUM(montant) AS montant FROM remboursements WHERE deleted_at IS NULL GROUP BY credit_id
        ), soldes AS (
          SELECT c.id, c.devise, c.date_echeance, GREATEST(0, c.montant * (1 + c.taux_interet / 100) - COALESCE(p.montant, 0)) AS restant
          FROM credits c LEFT JOIN paiements p ON p.credit_id = c.id
          WHERE c.date_debut >= ${debut} AND c.date_debut < ${finExclusive} AND c.statut IN ('actif', 'en_retard') AND c.date_echeance < CURRENT_DATE
        )
        SELECT devise, CASE
          WHEN CURRENT_DATE - date_echeance::date BETWEEN 1 AND 30 THEN '1-30'
          WHEN CURRENT_DATE - date_echeance::date BETWEEN 31 AND 60 THEN '31-60'
          WHEN CURRENT_DATE - date_echeance::date BETWEEN 61 AND 90 THEN '61-90'
          ELSE '90+'
        END AS tranche, SUM(restant) AS montant, COUNT(*)::bigint AS credits
        FROM soldes WHERE restant > 0 GROUP BY devise, tranche ORDER BY devise, tranche
      `,
      this.prisma.credit.findMany({
        where: upcomingWhere,
        include: { membre: { select: { id: true, nomComplet: true, numeroCompte: true } }, remboursements: { where: { deletedAt: null }, select: { montant: true } } },
        orderBy: { dateEcheance: 'asc' }, take: 100,
      }),
    ]);
    const detail = credits.map((credit) => {
      const totalDu = Number(credit.montant) * (1 + Number(credit.tauxInteret) / 100);
      const rembourse = credit.remboursements.reduce((sum, payment) => sum + Number(payment.montant), 0);
      const restant = Math.max(0, totalDu - rembourse);
      const joursRetard = credit.dateEcheance ? Math.max(0, Math.floor((Date.now() - credit.dateEcheance.getTime()) / 86_400_000)) : 0;
      return {
        id: credit.id, membreId: credit.membre.id, membre: credit.membre.nomComplet, numeroCompte: credit.membre.numeroCompte,
        montantAccorde: Number(credit.montant), totalDu, rembourse, restant, devise: credit.devise,
        dateDecaissement: credit.dateDebut, echeance: credit.dateEcheance, statut: credit.statut, joursRetard,
      };
    });
    const echeancesProches = upcomingCredits.flatMap((credit) => {
      const totalDu = Number(credit.montant) * (1 + Number(credit.tauxInteret) / 100);
      const rembourse = credit.remboursements.reduce((sum, payment) => sum + Number(payment.montant), 0);
      const restant = Math.max(0, totalDu - rembourse);
      return restant > 0 && credit.dateEcheance ? [{
        id: credit.id, membreId: credit.membre.id, membre: credit.membre.nomComplet, numeroCompte: credit.membre.numeroCompte,
        echeance: credit.dateEcheance, restant, devise: credit.devise,
      }] : [];
    });
    return {
      periode: { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) },
      credits: detail,
      echeances: echeancesProches,
      retards: ageing.map((row) => ({ ...row, montant: Number(row.montant), credits: Number(row.credits) })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      definitionRestant: 'Montant accordé × (1 + taux d’intérêt) moins remboursements non supprimés; plancher à zéro.',
    };
  }

  async getEvaluation(filters: { debut?: string; fin?: string }) {
    const { debut, fin } = this.requiredReportRange(filters.debut, filters.fin);
    const durationDays = Math.ceil((fin.getTime() - debut.getTime()) / 86_400_000) + 1;
    const previousFin = new Date(debut);
    previousFin.setUTCDate(previousFin.getUTCDate() - 1);
    const previousDebut = new Date(previousFin);
    previousDebut.setUTCDate(previousDebut.getUTCDate() - durationDays + 1);
    const date = (value: Date) => value.toISOString().slice(0, 10);
    const [current, previous] = await Promise.all([
      this.getSynthese({ debut: date(debut), fin: date(fin) }),
      this.getSynthese({ debut: date(previousDebut), fin: date(previousFin) }),
    ]);
    const compare = (label: string, formule: string, source: string, devise: 'FC' | 'USD' | '—', value: number, oldValue: number) => ({
      label, formule, source, devise, valeur: value, valeurPrecedente: oldValue,
      variation: value - oldValue,
      variationPourcent: oldValue === 0 ? null : Math.round(((value - oldValue) / Math.abs(oldValue)) * 10_000) / 100,
    });
    const indicateurs: ReturnType<typeof compare>[] = (['FC', 'USD'] as const).flatMap((devise) => [
      compare('Dépôts reçus', 'Somme des dépôts membres valides pendant la période', 'Épargnes non liées aux remboursements', devise, current.totaux.depots[devise], previous.totaux.depots[devise]),
      compare('Crédits décaissés', 'Somme des montants décaissés pendant la période', 'Crédits par date de décaissement', devise, current.totaux.creditsDecaisses[devise], previous.totaux.creditsDecaisses[devise]),
      compare('Remboursements encaissés', 'Somme des remboursements non supprimés pendant la période', 'Remboursements validés', devise, current.totaux.remboursements[devise], previous.totaux.remboursements[devise]),
    ]);
    indicateurs.push(compare('Nouvelles adhésions', 'Nombre de dates d’adhésion dans la période', 'Membres par date d’adhésion', '—', current.totaux.adhesions, previous.totaux.adhesions));
    return {
      periode: { debut: date(debut), fin: date(fin) },
      comparaison: { debut: date(previousDebut), fin: date(previousFin), dureeJours: durationDays },
      indicateurs,
      note: 'Indicateurs opérationnels uniquement. Ils ne représentent pas le résultat comptable; FC et USD restent séparés.',
    };
  }

  async getRapport(type: string, periode: string) {
    let start: Date;
    let end: Date;

    if (type === 'jour') {
      start = new Date(periode);
      start.setHours(0, 0, 0, 0);
      end = new Date(periode);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'semaine') {
      if (!/-W/.test(periode))
        throw new BadRequestException('Format de semaine invalide');
      const [year, week] = periode.split('-W');
      const y = parseInt(year);
      const w = parseInt(week);

      const firstDay = new Date(y, 0, 1 + (w - 1) * 7);
      while (firstDay.getDay() !== 1) firstDay.setDate(firstDay.getDate() - 1);

      start = new Date(firstDay);
      start.setHours(0, 0, 0, 0);

      end = new Date(firstDay);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'mois') {
      const [year, month] = periode.split('-');
      const y = parseInt(year);
      const m = parseInt(month);
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 0, 23, 59, 59, 999);
    } else if (type === 'annee') {
      const y = parseInt(periode);
      start = new Date(y, 0, 1, 0, 0, 0, 0);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
    } else {
      throw new BadRequestException('Type de période invalide');
    }

    const getSumEpargne = async (
      opType: TypeOperationEpargne,
      devise: string,
    ) => {
      const res = await this.prisma.epargne.aggregate({
        where: {
          typeOperation: opType,
          devise: devise as Devise,
          dateOperation: { gte: start, lte: end },
        },
        _sum: { montant: true },
      });
      return res._sum.montant || 0;
    };

    const getSumCredit = async (devise: string) => {
      const res = await this.prisma.credit.aggregate({
        where: {
          devise: devise as Devise,
          dateDebut: { gte: start, lte: end },
        },
        _sum: { montant: true },
      });
      return res._sum.montant || 0;
    };

    const getSumRemboursement = async (devise: string) => {
      const res = await this.prisma.remboursement.aggregate({
        where: {
          devise: devise as Devise,
          dateRemboursement: { gte: start, lte: end },
        },
        _sum: { montant: true },
      });
      return res._sum.montant || 0;
    };

    const results = await Promise.all([
      getSumEpargne(TypeOperationEpargne.depot, 'FC'),
      getSumEpargne(TypeOperationEpargne.depot, 'USD'),
      getSumEpargne(TypeOperationEpargne.retrait, 'FC'),
      getSumEpargne(TypeOperationEpargne.retrait, 'USD'),
      getSumCredit('FC'),
      getSumCredit('USD'),
      getSumRemboursement('FC'),
      getSumRemboursement('USD'),
    ]);

    return {
      epargne: results[0],
      epargneUSD: results[1],
      retrait: results[2],
      retraitUSD: results[3],
      credit: results[4],
      creditUSD: results[5],
      remboursement: results[6],
      remboursementUSD: results[7],
    };
  }
}
