import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  Devise,
  Prisma,
  ProprietaireType,
  SensEcriture,
  StatutOperation,
  TypeOperationComptable,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type DbTx = Prisma.TransactionClient;
type Ligne = { numeroCompte: string; sens: SensEcriture; montant: number; libelle: string };

@Injectable()
export class ComptabiliteService {
  constructor(private readonly prisma: PrismaService) {}

  private async compte(tx: DbTx, numeroCompte: string, devise: Devise) {
    const compte = await tx.compte.findFirst({
      where: { numeroCompte, devise, statut: 'ACTIF' },
    });
    if (!compte) throw new BadRequestException(`Compte comptable actif manquant: ${numeroCompte} (${devise})`);
    return compte;
  }

  private async compteAuxiliaireMembre(tx: DbTx, planNumero: string, numeroCompte: string, devise: Devise) {
    const membre = await tx.membre.findUnique({ where: { numeroCompte }, select: { id: true } });
    if (!membre) throw new BadRequestException(`Membre introuvable: ${numeroCompte}`);
    const plan = await tx.planComptable.findUnique({ where: { numero: planNumero } });
    if (!plan) throw new BadRequestException(`Compte collectif ${planNumero} absent du plan comptable.`);
    return tx.compte.upsert({
      where: {
        planCompteId_proprietaireType_proprietaireId_devise: {
          planCompteId: plan.id,
          proprietaireType: ProprietaireType.MEMBRE,
          proprietaireId: membre.id,
          devise,
        },
      },
      update: { statut: 'ACTIF' },
      create: {
        numeroCompte: `AUX-${planNumero}-${numeroCompte}-${devise}`,
        planCompteId: plan.id,
        proprietaireType: ProprietaireType.MEMBRE,
        proprietaireId: membre.id,
        devise,
        estSysteme: false,
        estAuxiliaire: true,
        statut: 'ACTIF',
      },
    });
  }

  private compteEpargneMembre(tx: DbTx, numeroCompte: string, devise: Devise) {
    return this.compteAuxiliaireMembre(tx, '4621', numeroCompte, devise);
  }

  private async enregistrer(tx: DbTx, params: {
    type: TypeOperationComptable;
    montantTotal: number;
    devise: Devise;
    lignes: Ligne[];
    codeAnalytique: string;
    executeParId?: number;
    executeParRole?: string;
    motif?: string;
    dateOperation?: Date;
    tauxChange?: number;
    idempotencyKey?: string;
  }) {
    const { type, montantTotal, devise, lignes, codeAnalytique, executeParId, executeParRole, motif } = params;
    if (!Number.isFinite(montantTotal) || montantTotal <= 0 || Math.abs(montantTotal * 100 - Math.round(montantTotal * 100)) > 0.0001 || lignes.length < 2) {
      throw new BadRequestException('Montant ou lignes comptables invalides.');
    }
    for (const ligne of lignes) {
      if (!Number.isFinite(ligne.montant) || ligne.montant <= 0 || Math.abs(ligne.montant * 100 - Math.round(ligne.montant * 100)) > 0.0001) {
        throw new BadRequestException('Chaque ligne comptable doit avoir un montant positif au centime près.');
      }
    }
    const debit = lignes.filter((l) => l.sens === SensEcriture.DEBIT).reduce((n, l) => n + l.montant, 0);
    const credit = lignes.filter((l) => l.sens === SensEcriture.CREDIT).reduce((n, l) => n + l.montant, 0);
    if (Math.abs(debit - credit) >= 0.005) {
      throw new BadRequestException(`Écriture déséquilibrée: débit ${debit}, crédit ${credit}.`);
    }
    if (Math.abs(debit - montantTotal) >= 0.005) {
      throw new BadRequestException(`Le total de l'opération (${montantTotal}) ne correspond pas au total comptabilisé (${debit}).`);
    }
    if (params.idempotencyKey) {
      const existing = await tx.operation.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
      if (existing) {
        if (existing.typeOperation !== type || existing.devise !== devise || Math.abs(Number(existing.montantTotal) - montantTotal) >= 0.005) {
          throw new ConflictException('La clé idempotente correspond déjà à une autre écriture comptable.');
        }
        return existing;
      }
    }
    const analytique = await tx.codeAnalytique.findUnique({ where: { code: codeAnalytique } });
    if (!analytique?.actif) throw new BadRequestException(`Code analytique invalide ou inactif: ${codeAnalytique}`);
    const comptes = await Promise.all(lignes.map((ligne) => this.compte(tx, ligne.numeroCompte, devise)));
    const date = params.dateOperation ?? new Date();
    const operation = await tx.operation.create({
      data: {
        reference: `OP-${date.getFullYear()}-${randomUUID()}`,
        typeOperation: type,
        montantTotal,
        devise,
        dateOperation: date,
        executeParId,
        executeParRole,
        statut: StatutOperation.VALIDEE,
        motif,
        tauxChange: params.tauxChange,
        montantFc: devise === Devise.FC ? montantTotal : (params.tauxChange ? montantTotal * params.tauxChange : undefined),
        idempotencyKey: params.idempotencyKey,
        codeAnalytiqueId: analytique.id,
      },
    });
    await tx.ecritureComptable.createMany({
      data: lignes.map((ligne, index) => ({
        operationId: operation.id,
        compteId: comptes[index].id,
        sens: ligne.sens,
        montant: ligne.montant,
        devise,
        libelle: ligne.libelle,
      })),
    });
    return operation;
  }

  async enregistrerAdhesion(tx: DbTx, params: {
    montant: number; devise: Devise; codeSection: string; executeParId?: number;
    executeParRole?: string; motif?: string; dateOperation?: Date; tauxChange?: number;
    idempotencyKey?: string;
  }) {
    const caisse = params.devise === Devise.USD ? 'GEN-5712-CAISSE-USD' : 'GEN-5711-CAISSE-FC';
    const revenu = `GEN-7061-DROITS-ADHESION-${params.devise}`;
    return this.enregistrer(tx, {
      type: TypeOperationComptable.ADHESION, montantTotal: params.montant, devise: params.devise,
      codeAnalytique: params.codeSection,
      executeParId: params.executeParId, executeParRole: params.executeParRole,
      motif: params.motif, dateOperation: params.dateOperation, tauxChange: params.tauxChange,
      idempotencyKey: params.idempotencyKey,
      lignes: [
        { numeroCompte: caisse, sens: SensEcriture.DEBIT, montant: params.montant, libelle: `Encaissement adhésion - ${params.codeSection}` },
        { numeroCompte: revenu, sens: SensEcriture.CREDIT, montant: params.montant, libelle: `Produit adhésion - ${params.codeSection}` },
      ],
    });
  }

  async enregistrerDepotEpargne(tx: DbTx, params: {
    montant: number; devise: Devise; numeroCompte: string; codeSection: string; executeParId?: number;
    executeParRole?: string; dateOperation?: Date; idempotencyKey?: string;
  }) {
    const caisse = params.devise === Devise.USD ? 'GEN-5712-CAISSE-USD' : 'GEN-5711-CAISSE-FC';
    const membre = await this.compteEpargneMembre(tx, params.numeroCompte, params.devise);
    const saved = await this.enregistrer(tx, {
      type: TypeOperationComptable.DEPOT_EPARGNE, montantTotal: params.montant, devise: params.devise,
      codeAnalytique: params.codeSection, executeParId: params.executeParId, executeParRole: params.executeParRole,
      dateOperation: params.dateOperation, idempotencyKey: params.idempotencyKey, motif: `Dépôt épargne ${params.numeroCompte}`,
      lignes: [
        { numeroCompte: caisse, sens: SensEcriture.DEBIT, montant: params.montant, libelle: 'Dépôt reçu en caisse' },
        { numeroCompte: membre.numeroCompte, sens: SensEcriture.CREDIT, montant: params.montant, libelle: `Épargne membre ${params.numeroCompte}` },
      ],
    });
    return saved;
  }

  async enregistrerRemboursementCredit(tx: DbTx, params: {
    montant: number; partPrincipal: number; partInteret: number; partMembre: number;
    devise: Devise; numeroCompte: string; codeSection: string; executeParId?: number;
    executeParRole?: string; dateOperation?: Date; idempotencyKey?: string;
  }) {
    const compteMembre = await this.compteEpargneMembre(tx, params.numeroCompte, params.devise);
    const compteCreditMembre = await this.compteAuxiliaireMembre(tx, '4111', params.numeroCompte, params.devise);
    const caisse = params.devise === Devise.USD ? 'GEN-5712-CAISSE-USD' : 'GEN-5711-CAISSE-FC';
    const partCooperative = Math.round((params.partInteret - params.partMembre) * 100) / 100;
    const lignes: Ligne[] = [
      { numeroCompte: caisse, sens: SensEcriture.DEBIT, montant: params.montant, libelle: `Encaissement remboursement ${params.numeroCompte}` },
      { numeroCompte: compteCreditMembre.numeroCompte, sens: SensEcriture.CREDIT, montant: params.partPrincipal, libelle: `Remboursement principal ${params.numeroCompte}` },
    ];
    if (partCooperative > 0) lignes.push({
      numeroCompte: `GEN-7711-INTERETS-CREDITS-${params.devise}`,
      sens: SensEcriture.CREDIT, montant: partCooperative, libelle: 'Intérêts acquis par la coopérative',
    });
    if (params.partMembre > 0) lignes.push({
      numeroCompte: compteMembre.numeroCompte,
      sens: SensEcriture.CREDIT, montant: params.partMembre, libelle: `Ristourne intérêts membre ${params.numeroCompte}`,
    });
    return this.enregistrer(tx, {
      type: TypeOperationComptable.INTERET_CREDIT, montantTotal: params.montant, devise: params.devise,
      codeAnalytique: params.codeSection, executeParId: params.executeParId, executeParRole: params.executeParRole,
      dateOperation: params.dateOperation, idempotencyKey: params.idempotencyKey,
      motif: `Remboursement de crédit du membre ${params.numeroCompte}`,
      lignes,
    });
  }

  async enregistrerRetraitEpargne(tx: DbTx, params: {
    montant: number; frais: number; devise: Devise; numeroCompte: string; codeSection: string;
    executeParId?: number; executeParRole?: string; dateOperation?: Date; idempotencyKey?: string;
  }) {
    const membre = await this.compteEpargneMembre(tx, params.numeroCompte, params.devise);
    const caisse = params.devise === Devise.USD ? 'GEN-5712-CAISSE-USD' : 'GEN-5711-CAISSE-FC';
    const montantDebite = params.montant + params.frais;
    const lignes: Ligne[] = [
      { numeroCompte: membre.numeroCompte, sens: SensEcriture.DEBIT, montant: montantDebite, libelle: `Retrait épargne ${params.numeroCompte}` },
      { numeroCompte: caisse, sens: SensEcriture.CREDIT, montant: params.montant, libelle: `Espèces remises au membre ${params.numeroCompte}` },
    ];
    if (params.frais > 0) lignes.push({
      numeroCompte: `GEN-7063-FRAIS-RETRAIT-${params.devise}`,
      sens: SensEcriture.CREDIT, montant: params.frais, libelle: 'Frais de retrait',
    });
    const compteCreditMembre = await this.compteAuxiliaireMembre(tx, '4111', params.numeroCompte, params.devise);
    return this.enregistrer(tx, {
      type: params.frais ? TypeOperationComptable.FRAIS_RETRAIT : TypeOperationComptable.RETRAIT_EPARGNE,
      montantTotal: montantDebite, devise: params.devise, codeAnalytique: params.codeSection,
      executeParId: params.executeParId, executeParRole: params.executeParRole,
      dateOperation: params.dateOperation, idempotencyKey: params.idempotencyKey,
      motif: `Retrait épargne du membre ${params.numeroCompte}`,
      lignes,
    });
  }

  async enregistrerDecaissementCredit(tx: DbTx, params: {
    montant: number; devise: Devise; numeroCompte: string; codeSection: string;
    executeParId?: number; executeParRole?: string; dateOperation?: Date; idempotencyKey?: string;
  }) {
    const caisse = params.devise === Devise.USD ? 'GEN-5712-CAISSE-USD' : 'GEN-5711-CAISSE-FC';
    const compteCreditMembre = await this.compteAuxiliaireMembre(tx, '4111', params.numeroCompte, params.devise);
    return this.enregistrer(tx, {
      type: TypeOperationComptable.DECAISSEMENT_CREDIT,
      montantTotal: params.montant, devise: params.devise, codeAnalytique: params.codeSection,
      executeParId: params.executeParId, executeParRole: params.executeParRole,
      dateOperation: params.dateOperation, idempotencyKey: params.idempotencyKey,
      motif: `Décaissement crédit membre ${params.numeroCompte}`,
      lignes: [
        { numeroCompte: compteCreditMembre.numeroCompte, sens: SensEcriture.DEBIT, montant: params.montant, libelle: `Crédit octroyé à ${params.numeroCompte}` },
        { numeroCompte: caisse, sens: SensEcriture.CREDIT, montant: params.montant, libelle: `Décaissement caisse vers ${params.numeroCompte}` },
      ],
    });
  }

  async enregistrerOuvertureCaisse(tx: DbTx, params: {
    montant: number; devise: Devise; executeParId?: number; executeParRole?: string;
    dateOperation?: Date; idempotencyKey: string; motif: string;
  }) {
    const caisse = params.devise === Devise.USD ? 'GEN-5712-CAISSE-USD' : 'GEN-5711-CAISSE-FC';
    return this.enregistrer(tx, {
      type: TypeOperationComptable.AJUSTEMENT, montantTotal: params.montant, devise: params.devise,
      codeAnalytique: 'MW-GEN', executeParId: params.executeParId, executeParRole: params.executeParRole,
      dateOperation: params.dateOperation, idempotencyKey: params.idempotencyKey, motif: params.motif,
      lignes: [
        { numeroCompte: caisse, sens: SensEcriture.DEBIT, montant: params.montant, libelle: 'Ouverture solde de caisse' },
        { numeroCompte: `GEN-4630-TRANSITOIRE-${params.devise}`, sens: SensEcriture.CREDIT, montant: params.montant, libelle: 'Contrepartie transitoire du solde initial' },
      ],
    });
  }

  async contrepasser(tx: DbTx, params: {
    idempotencyKey: string; executeParId?: number; executeParRole?: string; motif: string;
  }) {
    const original = await tx.operation.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      include: { ecritures: true },
    });
    if (!original) return null; // Opération antérieure à la bascule comptable.
    const reversalKey = `REV-${params.idempotencyKey}`;
    const existing = await tx.operation.findUnique({ where: { idempotencyKey: reversalKey } });
    if (existing) return existing;
    if (original.statut === StatutOperation.ANNULEE) return null;
    if (!original.ecritures.length) throw new BadRequestException('Impossible de contrepasser une opération sans lignes.');
    const reversal = await tx.operation.create({
      data: {
        reference: `OP-${new Date().getFullYear()}-${randomUUID()}`,
        typeOperation: TypeOperationComptable.CONTREPASSATION,
        montantTotal: original.montantTotal,
        devise: original.devise,
        dateOperation: new Date(),
        executeParId: params.executeParId,
        executeParRole: params.executeParRole,
        statut: StatutOperation.VALIDEE,
        motif: params.motif,
        idempotencyKey: reversalKey,
        codeAnalytiqueId: original.codeAnalytiqueId,
      },
    });
    await tx.ecritureComptable.createMany({
      data: original.ecritures.map((ecriture) => ({
        operationId: reversal.id,
        compteId: ecriture.compteId,
        sens: ecriture.sens === SensEcriture.DEBIT ? SensEcriture.CREDIT : SensEcriture.DEBIT,
        montant: ecriture.montant,
        devise: ecriture.devise,
        libelle: `Contrepassation: ${ecriture.libelle}`,
      })),
    });
    await tx.operation.update({ where: { id: original.id }, data: { statut: StatutOperation.ANNULEE } });
    return reversal;
  }

  async verifierEquilibre(operationId: string) {
    const ecritures = await this.prisma.ecritureComptable.findMany({ where: { operationId } });
    if (ecritures.length === 0) throw new BadRequestException('Aucune écriture trouvée');
    const debit = ecritures.filter((e) => e.sens === SensEcriture.DEBIT).reduce((s, e) => s + Number(e.montant), 0);
    const credit = ecritures.filter((e) => e.sens === SensEcriture.CREDIT).reduce((s, e) => s + Number(e.montant), 0);
    return { operationId, debit, credit, equilibre: Math.abs(debit - credit) < 0.005, ecart: debit - credit };
  }
}
