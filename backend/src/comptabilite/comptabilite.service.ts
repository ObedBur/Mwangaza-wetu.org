import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Devise, SensEcriture, StatutOperation, TypeOperationComptable } from '@prisma/client';

@Injectable()
export class ComptabiliteService {
  constructor(private readonly prisma: PrismaService) {}

  async enregistrerAdhesion(params: {
    montant: number;
    devise: Devise;
    codeSection: string; // MW-BIA, MW-KEL,...
    executeParId?: number;
    executeParRole?: string;
    motif?: string;
  }) {
    const { montant, devise, codeSection, executeParId, executeParRole, motif } = params;

    if (montant <= 0) throw new BadRequestException('Montant invalide');

    const codeAnalytique = await this.prisma.codeAnalytique.findUnique({
      where: { code: codeSection },
    });
    if (!codeAnalytique || !codeAnalytique.actif) {
      throw new BadRequestException(`Code analytique invalide ou inactif: ${codeSection}`);
    }

    const compteCaisse = await this.prisma.compte.findFirst({
      where: { numeroCompte: 'GEN-571-CAISSE-FC', statut: 'ACTIF' },
    });
    const compteDroits = await this.prisma.compte.findFirst({
      where: { numeroCompte: 'GEN-7061-DROITS-ADHESION', statut: 'ACTIF' },
    });

    if (!compteCaisse || !compteDroits) {
      throw new BadRequestException('Comptes généraux manquants. Lancer le seed-compta.');
    }

    const year = new Date().getFullYear();
    const count = await this.prisma.operation.count();
    const reference = `OP-${year}-${String(count + 1).padStart(6, '0')}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const operation = await tx.operation.create({
        data: {
          reference,
          typeOperation: TypeOperationComptable.ADHESION,
          montantTotal: montant,
          devise,
          dateOperation: new Date(),
          executeParId,
          executeParRole,
          statut: StatutOperation.VALIDEE,
          motif: motif || `Frais d'adhésion (${codeSection})`,
          codeAnalytiqueId: codeAnalytique.id,
        },
      });

      await tx.ecritureComptable.createMany({
        data: [
          {
            operationId: operation.id,
            compteId: compteCaisse.id,
            sens: SensEcriture.DEBIT,
            montant,
            devise,
            libelle: `Encaissement frais d'adhésion - ${codeSection}`,
          },
          {
            operationId: operation.id,
            compteId: compteDroits.id,
            sens: SensEcriture.CREDIT,
            montant,
            devise,
            libelle: `Produit frais d'adhésion - ${codeSection}`,
          },
        ],
      });

      return operation;
    });

    return result;
  }

  async verifierEquilibre(operationId: string) {
    const ecritures = await this.prisma.ecritureComptable.findMany({
      where: { operationId },
    });

    if (ecritures.length === 0) throw new BadRequestException('Aucune écriture trouvée');

    let debit = 0;
    let credit = 0;

    for (const e of ecritures) {
      const m = Number(e.montant);
      if (e.sens === SensEcriture.DEBIT) debit += m;
      if (e.sens === SensEcriture.CREDIT) credit += m;
    }

    return {
      operationId,
      debit,
      credit,
      equilibre: Math.abs(debit - credit) < 0.0001,
      ecart: debit - credit,
    };
  }
}
