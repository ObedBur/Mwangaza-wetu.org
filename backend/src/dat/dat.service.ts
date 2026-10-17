import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParametresService } from '../parametres/parametres.service';
import { CreateDatDto } from './dto/create-dat.dto';
import type { DatDuree } from '../parametres/parametres.service';
import { Devise, StatutDat } from '@prisma/client';

/** Statuts pour lesquels le membre ne peut PAS ouvrir un second DAT. */
const STATUTS_ACTIFS: StatutDat[] = [StatutDat.OUVERT, StatutDat.ECHEANCE];

/** Barème par durée (base de jours du dossier §3.2). */
const BASE_JOURS: Record<number, number> = { 1: 31, 3: 93, 6: 186, 12: 365 };

@Injectable()
export class DatService {
  constructor(
    private prisma: PrismaService,
    private parametres: ParametresService,
  ) {}

  // ── Soldes ────────────────────────────────────────────────────────
  /**
   * Solde d'un sous-compte : dépôts − retraits, filtré sur typeCompte.
   * Le DAT et le Principal ont le même numéro mais ne se mélangent jamais.
   */
  async getSolde(
    numeroCompte: string,
    typeCompte: 'PRINCIPAL' | 'DAT' = 'PRINCIPAL',
  ) {
    const [depots, retraits] = await Promise.all([
      this.prisma.epargne.groupBy({
        by: ['devise'],
        where: { compte: numeroCompte, typeCompte, typeOperation: 'depot' },
        _sum: { montant: true },
      }),
      this.prisma.epargne.groupBy({
        by: ['devise'],
        where: { compte: numeroCompte, typeCompte, typeOperation: 'retrait' },
        _sum: { montant: true },
      }),
    ]);

    const somme = (
      rows: { devise: Devise; _sum: { montant: any } }[],
      devise: Devise,
    ) => {
      const row = rows.find((r) => r.devise === devise);
      return row?._sum.montant ? Number(row._sum.montant) : 0;
    };

    return {
      FC: somme(depots, Devise.FC) - somme(retraits, Devise.FC),
      USD: somme(depots, Devise.USD) - somme(retraits, Devise.USD),
    };
  }

  /** Solde d'un sous-compte pour UNE devise donnée. */
  async getSoldeDevise(
    numeroCompte: string,
    typeCompte: 'PRINCIPAL' | 'DAT',
    devise: Devise,
  ): Promise<number> {
    const [depots, retraits] = await Promise.all([
      this.prisma.epargne.aggregate({
        where: { compte: numeroCompte, typeCompte, typeOperation: 'depot', devise },
        _sum: { montant: true },
      }),
      this.prisma.epargne.aggregate({
        where: { compte: numeroCompte, typeCompte, typeOperation: 'retrait', devise },
        _sum: { montant: true },
      }),
    ]);
    return (
      Number(depots._sum.montant ?? 0) - Number(retraits._sum.montant ?? 0)
    );
  }

  // ── Barème ────────────────────────────────────────────────────────
  /** Barème DAT (taux + minimums + seuils), lu en base — zéro valeur en dur. */
  async getBareme() {
    const params = await this.parametres.getDatParameters();
    return {
      retraitAnticipéInterdit: params.retraitAnticipéInterdit,
      durees: params.durees.map((d) => {
        const gainDe = (capital: number, seuil: number) =>
          capital >= seuil
            ? Math.round(capital * (d.tauxPeriode / 100) * 100) / 100
            : 0;
        return {
          dureeMois: d.dureeMois,
          baseJours: d.baseJours,
          tauxPeriode: d.tauxPeriode,
          /** Ce rapport rapporte-t-il quelque chose ? */
          rapporte: d.tauxPeriode > 0,
          minFc: d.minFc,
          minUsd: d.minUsd,
          seuilGainFc: d.seuilGainFc,
          seuilGainUsd: d.seuilGainUsd,
          // Gain au minimum d'ouverture — tient compte du seuil
          gainMinFc: gainDe(d.minFc, d.seuilGainFc),
          gainMinUsd: gainDe(d.minUsd, d.seuilGainUsd),
          // Aide à la saisie : montant à atteindre pour gagner
          messageSeuil:
            d.tauxPeriode > 0 && d.seuilGainFc > 0
              ? `Intérêt de ${d.tauxPeriode} % uniquement si le capital ` +
                `placé atteint ${d.seuilGainFc.toLocaleString('fr-FR')} FC ` +
                `ou ${d.seuilGainUsd} USD.`
              : d.tauxPeriode === 0
                ? `Ce rapport n'applique aucun intérêt : le capital est ` +
                  `simplement bloqué pendant ${d.dureeMois} mois.`
                : undefined,
        };
      }),
    };
  }

  /** Seuil de gain d'une durée, selon la devise. */
  private seuilDe(bareme: DatDuree, devise: Devise): number {
    return devise === Devise.FC ? bareme.seuilGainFc : bareme.seuilGainUsd;
  }

  /**
   * Gain d'un DAT : capital × taux de période, SOUS LA RÉSERVE que le
   * capital placé atteigne le seuil. Sous le seuil (ou durée sans
   * intérêt), le DAT s'ouvre mais ne rapporte rien.
   */
  private calculerGain(
    capital: number,
    bareme: DatDuree,
    devise: Devise,
  ): { gain: number; seuilGain: number; seuilAtteint: boolean } {
    const seuilGain = this.seuilDe(bareme, devise);
    const seuilAtteint = capital >= seuilGain;
    const gain = seuilAtteint
      ? Math.round(capital * (bareme.tauxPeriode / 100) * 100) / 100
      : 0;
    return { gain, seuilGain, seuilAtteint };
  }

  // ── Ouverture ─────────────────────────────────────────────────────
  async ouvrir(dto: CreateDatDto, userId?: number) {
    // 1. Le membre existe-t-il ?
    const membre = await this.prisma.membre.findUnique({
      where: { numeroCompte: dto.numeroCompte },
    });
    if (!membre) {
      throw new NotFoundException(
        `Membre ${dto.numeroCompte} introuvable`,
      );
    }

    // 2. Règle « 1 seul DAT actif par membre »
    const actif = await this.prisma.dat.findFirst({
      where: {
        numeroCompte: dto.numeroCompte,
        statut: { in: STATUTS_ACTIFS },
      },
    });
    if (actif) {
      throw new ConflictException(
        `Un DAT est déjà en cours (n°${actif.id}, échéance le ` +
          `${actif.dateEcheance.toLocaleDateString('fr-FR')}). ` +
          `Un seul DAT à la fois : veuillez attendre son échéance.`,
      );
    }

    // 3. Durée autorisée par le barème
    const bareme = await this.parametres.getDatDuree(dto.dureeMois);
    if (!bareme) {
      throw new BadRequestException(
        `Durée non autorisée : ${dto.dureeMois} mois. Durées possibles : 1, 3, 6, 12 mois.`,
      );
    }

    // 4. Minimum d'ouverture selon la devise
    const minimum = dto.devise === Devise.FC ? bareme.minFc : bareme.minUsd;
    if (dto.montant < minimum) {
      throw new BadRequestException(
        `Montant minimum pour un DAT de ${dto.dureeMois} mois : ` +
          `${minimum} ${dto.devise}.`,
      );
    }

    // 5. Le membre a-t-il assez sur son Compte Principal ?
    const soldePrincipal = await this.getSoldeDevise(
      dto.numeroCompte,
      'PRINCIPAL',
      dto.devise,
    );
    if (soldePrincipal < dto.montant) {
      throw new BadRequestException(
        `Solde insuffisant sur le Compte Principal : ` +
          `${soldePrincipal} ${dto.devise} disponibles, ` +
          `${dto.montant} ${dto.devise} requis.`,
      );
    }

    // 6. Dates et gain — taux FIGÉ au moment de l'ouverture
    const dateOuverture = dto.dateOuverture
      ? new Date(`${dto.dateOuverture}T00:00:00.000Z`)
      : new Date();
    if (Number.isNaN(dateOuverture.getTime())) {
      throw new BadRequestException('Date d\'ouverture invalide');
    }

    const dateEcheance = new Date(dateOuverture);
    dateEcheance.setMonth(dateEcheance.getMonth() + dto.dureeMois);

    const capital = dto.montant;
    // Gain conditionné au seuil : sous le seuil, ou durée sans intérêt, gain = 0
    const { gain, seuilGain, seuilAtteint } = this.calculerGain(
      capital,
      bareme,
      dto.devise,
    );

    // 7. Écriture atomique : DAT + sortie du Principal + entrée sur le DAT
    const resultat = await this.prisma.$transaction(async (tx) => {
      const dat = await tx.dat.create({
        data: {
          numeroCompte: dto.numeroCompte,
          devise: dto.devise,
          capital,
          tauxPeriode: bareme.tauxPeriode,
          dureeMois: dto.dureeMois,
          baseJours: bareme.baseJours,
          gain,
          dateOuverture,
          dateEcheance,
          statut: StatutDat.OUVERT,
        },
      });

      // Sortie du Compte Principal (solde libre)
      await tx.epargne.create({
        data: {
          compte: dto.numeroCompte,
          typeOperation: 'retrait',
          typeCompte: 'PRINCIPAL',
          devise: dto.devise,
          montant: capital,
          dateOperation: dateOuverture,
          description: `Blocage DAT ${dto.dureeMois} mois (n°${dat.id})`,
        },
      });

      // Entrée sur le sous-compte DAT (solde bloqué)
      await tx.epargne.create({
        data: {
          compte: dto.numeroCompte,
          typeOperation: 'depot',
          typeCompte: 'DAT',
          devise: dto.devise,
          montant: capital,
          dateOperation: dateOuverture,
          description: `Ouverture DAT ${dto.dureeMois} mois (n°${dat.id})`,
        },
      });

      return this.format(dat, {
        soldePrincipal: soldePrincipal - capital,
        soldeDat: capital,
        seuilGain,
        seuilAtteint,
        // Explique un gain à 0 : soit durée sans intérêt, soit seuil non atteint
        motifGainNul: gain > 0
          ? undefined
          : bareme.tauxPeriode === 0
            ? `Le DAT de ${dto.dureeMois} mois n'applique aucun intérêt.`
            : `Capital inférieur au seuil de ${seuilGain.toLocaleString('fr-FR')} ` +
              `${dto.devise} : pas d'intérêt.`,
      });
    });

    await this.journal(
      `DAT_OUVERTURE_${resultat.id}`,
      `DAT n°${resultat.id} — ${dto.numeroCompte} : ${capital} ${dto.devise} ` +
        `bloqués ${dto.dureeMois} mois au taux de période ${bareme.tauxPeriode} % ` +
        (seuilAtteint
          ? `(gain attendu ${gain} ${dto.devise}, échéance ` +
            `${resultat.dateEcheance.toLocaleDateString('fr-FR')})`
          : `— seuil de ${seuilGain.toLocaleString('fr-FR')} ${dto.devise} ` +
            `non atteint, aucun gain, échéance ` +
            `${resultat.dateEcheance.toLocaleDateString('fr-FR')})`),
      userId,
      true,
    );

    return resultat;
  }

  // ── Clôture à l'échéance (membre présent au guichet) ──────────────
  /**
   * Capital + intérêts versés sur le Compte Principal (§3.1).
   * Le DAT doit avoir atteint son échéance : pas de gain avant terme,
   * et aucun retrait anticipé (décision E1).
   */
  async cloturer(id: number, userId?: number) {
    const dat = await this.prisma.dat.findUnique({ where: { id } });
    if (!dat) throw new NotFoundException(`DAT n°${id} introuvable`);

    if (dat.statut === StatutDat.CLOTURE) {
      throw new ConflictException(`DAT n°${id} déjà clôturé`);
    }
    if (dat.statut === StatutDat.ANNULE) {
      throw new ConflictException(`DAT n°${id} annulé — clôture impossible`);
    }

    const now = new Date();
    if (now < dat.dateEcheance) {
      const reste = Math.ceil(
        (dat.dateEcheance.getTime() - now.getTime()) / 86_400_000,
      );
      throw new BadRequestException(
        `Échéance non atteinte : il reste ${reste} jour(s) ` +
          `(échéance le ${dat.dateEcheance.toLocaleDateString('fr-FR')}). ` +
          `Le retrait anticipé est interdit.`,
      );
    }

    const capital = Number(dat.capital);
    const gain = Number(dat.gain);
    const total = Math.round((capital + gain) * 100) / 100;
    const echeance = now > dat.dateEcheance ? now : dat.dateEcheance;

    const resultat = await this.prisma.$transaction(async (tx) => {
      // Sortie du sous-compte DAT
      await tx.epargne.create({
        data: {
          compte: dat.numeroCompte,
          typeOperation: 'retrait',
          typeCompte: 'DAT',
          devise: dat.devise,
          montant: capital,
          dateOperation: echeance,
          description: `Clôture DAT n°${dat.id} (${dat.dureeMois} mois)`,
        },
      });
      // Capital + gain versés au Compte Principal
      await tx.epargne.create({
        data: {
          compte: dat.numeroCompte,
          typeOperation: 'depot',
          typeCompte: 'PRINCIPAL',
          devise: dat.devise,
          montant: total,
          dateOperation: echeance,
          description:
            `Versement DAT n°${dat.id} — capital ${capital} + gain ${gain} ${dat.devise}`,
        },
      });

      const maj = await tx.dat.update({
        where: { id },
        data: { statut: StatutDat.CLOTURE },
      });

      return this.format(maj, {
        verseCapital: capital,
        verseGain: gain,
        verseTotal: total,
      });
    });

    await this.journal(
      `DAT_CLOTURE_${id}`,
      `DAT n°${id} (${dat.dureeMois} mois) clôturé — versement sur le ` +
        `Compte Principal de ${dat.numeroCompte} : capital ${capital} + ` +
        `gain ${gain} = ${total} ${dat.devise}`,
      userId,
      true,
    );

    return resultat;
  }

  // ── Annulation avec contrepassation (§8.3) ────────────────────────
  /**
   * Tout DAT peut être annulé, mais :
   *  - le motif est OBLIGATOIRE
   *  - les écritures sont CONTREPASSÉES (annulées par écriture inverse),
   *    jamais supprimées : l'historique reste lisible (§8.3)
   *  - le gain n'est JAMAIS versé en cas d'annulation
   * Un DAT clôturé ne peut plus être annulé (il a produit ses effets).
   */
  async annuler(id: number, motif: string, userId?: number) {
    if (!motif || !motif.trim()) {
      throw new BadRequestException('Le motif d’annulation est obligatoire (§8.3)');
    }

    const dat = await this.prisma.dat.findUnique({ where: { id } });
    if (!dat) throw new NotFoundException(`DAT n°${id} introuvable`);

    if (dat.statut === StatutDat.CLOTURE) {
      throw new ConflictException(
        `DAT n°${id} déjà clôturé : annulation impossible, le capital a été versé.`,
      );
    }
    if (dat.statut === StatutDat.ANNULE) {
      throw new ConflictException(`DAT n°${id} déjà annulé`);
    }

    const capital = Number(dat.capital);
    const now = new Date();

    const resultat = await this.prisma.$transaction(async (tx) => {
      // Contrepassation : écriture inverse du blocage du DAT
      await tx.epargne.create({
        data: {
          compte: dat.numeroCompte,
          typeOperation: 'retrait',
          typeCompte: 'DAT',
          devise: dat.devise,
          montant: capital,
          dateOperation: now,
          description: `Contrepassation ouverture DAT n°${dat.id} — ${motif}`,
        },
      });

      // Contrepassation : remboursement intégral sur le Principal
      // (aucun gain — le DAT n'a pas été exécuté)
      await tx.epargne.create({
        data: {
          compte: dat.numeroCompte,
          typeOperation: 'depot',
          typeCompte: 'PRINCIPAL',
          devise: dat.devise,
          montant: capital,
          dateOperation: now,
          description: `Remboursement suite annulation DAT n°${dat.id} — ${motif}`,
        },
      });

      return tx.dat.update({
        where: { id },
        data: { statut: StatutDat.ANNULE, motif: motif.trim() },
      });
    });

    await this.journal(
      `DAT_ANNULATION_${id}`,
      `DAT n°${id} (${dat.dureeMois} mois, ${capital} ${dat.devise}) annulé — motif : ${motif}`,
      userId,
      true,
    );

    return this.format(resultat, {
      rembourseCapital: capital,
      motifAnnulation: motif,
    });
  }

  // ── Journal d'audit (§8.3 — table admin_logs) ─────────────────────
  private async journal(
    action: string,
    details: string,
    userId?: number,
    success = true,
  ) {
    try {
      await this.prisma.adminLog.create({
        data: { action, details, success, userId: userId ?? null },
      });
    } catch {
      // Le journal ne doit jamais faire échouer une opération financière
    }
  }

  // ── Consultation ──────────────────────────────────────────────────
  async findAll(numeroCompte?: string) {
    const dats = await this.prisma.dat.findMany({
      where: numeroCompte ? { numeroCompte } : undefined,
      orderBy: { dateOuverture: 'desc' },
      include: {
        membre: {
          select: { nomComplet: true, telephone: true, numeroCompte: true },
        },
      },
    });
    return dats.map((d) => this.format(d));
  }

  async findOne(id: number) {
    const dat = await this.prisma.dat.findUnique({
      where: { id },
      include: {
        membre: {
          select: { nomComplet: true, telephone: true, numeroCompte: true },
        },
      },
    });
    if (!dat) throw new NotFoundException(`DAT n°${id} introuvable`);
    return this.format(dat);
  }

  /** DAT arrivés à échéance et non encore réclamés au guichet. */
  async findEcheances() {
    const dats = await this.prisma.dat.findMany({
      where: {
        statut: StatutDat.OUVERT,
        dateEcheance: { lte: new Date() },
      },
      orderBy: { dateEcheance: 'asc' },
      include: {
        membre: {
          select: { nomComplet: true, telephone: true, numeroCompte: true },
        },
      },
    });
    return dats.map((d) => this.format(d));
  }

  /** Résumé pour le tableau de bord. */
  async getStats() {
    const [ouverts, echeances, totalBloque, gainsAttendus] =
      await Promise.all([
        this.prisma.dat.count({ where: { statut: StatutDat.OUVERT } }),
        this.prisma.dat.count({
          where: {
            statut: StatutDat.OUVERT,
            dateEcheance: { lte: new Date() },
          },
        }),
        this.prisma.dat.aggregate({
          where: { statut: { in: STATUTS_ACTIFS } },
          _sum: { capital: true },
          _count: { _all: true },
        }),
        this.prisma.dat.aggregate({
          where: { statut: { in: STATUTS_ACTIFS } },
          _sum: { gain: true },
        }),
      ]);

    return {
      datOuverts: ouverts,
      datAEcheance: echeances,
      capitalBloque: Number(totalBloque._sum.capital ?? 0),
      gainsAttendus: Number(gainsAttendus._sum.gain ?? 0),
    };
  }

  // ── Formatage commun ──────────────────────────────────────────────
  private format(dat: any, extra: Record<string, unknown> = {}) {
    const capital = Number(dat.capital);
    const gain = Number(dat.gain);
    const now = new Date();
    const joursRestants = Math.max(
      0,
      Math.ceil((dat.dateEcheance.getTime() - now.getTime()) / 86_400_000),
    );

    return {
      id: dat.id,
      numeroCompte: dat.numeroCompte,
      membre: dat.membre
        ? {
            nomComplet: dat.membre.nomComplet,
            telephone: dat.membre.telephone,
          }
        : undefined,
      devise: dat.devise,
      capital,
      tauxPeriode: Number(dat.tauxPeriode),
      dureeMois: dat.dureeMois,
      baseJours: dat.baseJours,
      gain,
      totalDu: Math.round((capital + gain) * 100) / 100,
      dateOuverture: dat.dateOuverture,
      dateEcheance: dat.dateEcheance,
      statut: dat.statut,
      joursRestants,
      motif: dat.motif ?? undefined,
      ...extra,
    };
  }
}
