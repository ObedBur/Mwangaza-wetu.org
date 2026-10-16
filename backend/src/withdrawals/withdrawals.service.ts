import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { Devise, TypeOperationEpargne } from '@prisma/client';
import { ParametresService } from '../parametres/parametres.service';
import { getSectionTrigram } from '../common/constants/sections';
import { BalancesService } from '../balances/balances.service';

@Injectable()
export class WithdrawalsService {
  constructor(
    private prisma: PrismaService,
    private parametresService: ParametresService,
    private balancesService: BalancesService,
  ) {}

  private async getFeesConfig(devise: string) {
    const params = await this.parametresService.getGeneralParameters();
    if (
      params.retraits?.frais_retrait &&
      params.retraits.frais_retrait[devise]
    ) {
      return params.retraits.frais_retrait[devise];
    }

    // Official BCC Rate for strict equivalence
    const TAUX_BCC = 2217.3;
    const SEUIL_50_USD = 50;
    const SEUIL_200_USD = 200;

    const SEUIL_50_FC = SEUIL_50_USD * TAUX_BCC; // 110,865 FC
    const SEUIL_200_FC = SEUIL_200_USD * TAUX_BCC; // 443,460 FC

    if (devise === 'FC') {
      return [
        { max: SEUIL_50_FC, taux: 0.03 },
        { max: SEUIL_200_FC, taux: 0.025 },
        { max: Infinity, taux: 0.015 },
      ];
    }
    return [
      { max: SEUIL_50_USD, taux: 0.03 },
      { max: SEUIL_200_USD, taux: 0.025 },
      { max: Infinity, taux: 0.015 },
    ];
  }

  private async calculateFees(montant: number, devise: string) {
    const structure = await this.getFeesConfig(devise);

    // Non-progressive calculation (based on total amount)
    let tauxApplique = 0.03; // Default for lowest tier

    for (const palier of structure) {
      if (montant <= palier.max) {
        tauxApplique = palier.taux;
        break;
      }
      tauxApplique = palier.taux; // Case for last tier (Infinity)
    }

    const frais = montant * tauxApplique;
    return Math.round(frais * 100) / 100;
  }

  async verifyLimites(compte: string, montant: number, devise: string) {
    const params = await this.parametresService.getGeneralParameters();

    // 1. Vérifier les heures autorisées (DÉSACTIVÉ POUR LES TESTS)
    // const now = new Date();
    // const heureActuelle = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // if (params.heures_autorisees) {
    //   if (
    //     heureActuelle < params.heures_autorisees.debut ||
    //     heureActuelle > params.heures_autorisees.fin
    //   ) {
    //     throw new BadRequestException(
    //       `Les retraits sont autorisés uniquement entre ${params.heures_autorisees.debut} et ${params.heures_autorisees.fin}`,
    //     );
    //   }
    // }

    // 2. Vérifier montant minimum
    const montantMin =
      devise === 'FC'
        ? params.montant_min_retrait_fc
        : params.montant_min_retrait_usd;
    if (montant < montantMin) {
      throw new BadRequestException(
        `Le montant minimum de retrait est de ${montantMin} ${devise}`,
      );
    }

    // 3. Vérifier montant maximum par retrait
    const montantMax =
      devise === 'FC'
        ? params.montant_max_par_retrait_fc
        : params.montant_max_par_retrait_usd;
    if (montant > montantMax) {
      throw new BadRequestException(
        `Le montant maximum par retrait est de ${montantMax} ${devise}`,
      );
    }

    // 4. Vérifier solde disponible (incluant solde minimum requis et garanties de crédit)
    const soldes = await this.balancesService.getSoldeDisponibleMembre(compte);

    const deviseKey = devise === 'USD' ? 'usd' : 'fc';
    const soldeDisponible = soldes[deviseKey].soldeDisponible;
    const soldeActuel = soldes[deviseKey].soldeBrut;

    const soldeMin =
      devise === 'FC' ? params.solde_min_fc : params.solde_min_usd;

    if (soldeDisponible - montant < soldeMin) {
      const g = soldes[deviseKey].garantieGelee;
      const messageGarantie =
        g > 0 ? ` (dont ${g} ${devise} gelés en garantie de crédit)` : '';

      throw new BadRequestException(
        `Solde insuffisant${messageGarantie}. Solde disponible pour retrait: ${soldeDisponible} ${devise}. ` +
          `Minimum requis: ${soldeMin} ${devise}`,
      );
    }

    // 5. Vérifier limite quotidienne
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sumRetraitsAujourdhui = await this.prisma.epargne.aggregate({
      where: {
        compte,
        devise: devise as Devise,
        typeOperation: TypeOperationEpargne.retrait,
        dateOperation: {
          gte: today,
        },
      },
      _sum: { montant: true },
    });

    const totalAujourdhui = Number(sumRetraitsAujourdhui._sum.montant || 0);
    const limiteJour =
      devise === 'FC'
        ? params.limite_retrait_jour_fc
        : params.limite_retrait_jour_usd;

    if (totalAujourdhui + montant > limiteJour) {
      throw new BadRequestException(
        `Limite de retrait quotidienne dépassée: ${limiteJour} ${devise}`,
      );
    }

    return { success: true, soldeActuel };
  }

  async create(dto: CreateWithdrawalDto) {
    const { compte, montant, devise, dateOperation, description } = dto;

    try {
      console.log('🔍 Création retrait - Données reçues:', {
        compte,
        montant,
        devise,
        dateOperation,
        description,
      });

      const dateO = new Date(dateOperation);

      // 0. Récupérer les informations du membre pour son type de compte
      const membre = await this.prisma.membre.findUnique({
        where: { numeroCompte: compte },
        select: { typeCompte: true },
      });

      if (!membre) {
        throw new BadRequestException(
          `Membre avec le compte ${compte} non trouvé`,
        );
      }

      console.log('✅ Membre trouvé:', compte, 'Type:', membre.typeCompte);

      const { soldeActuel } = await this.verifyLimites(compte, montant, devise);
      console.log('✅ Limites vérifiées - Solde actuel:', soldeActuel);

      const frais = await this.calculateFees(montant, devise);
      console.log('✅ Frais calculés:', frais);

      const soldeApres = soldeActuel - (montant + frais);

      const retrait = await this.prisma.$transaction(async (tx) => {
        // 1. Enregistrer le retrait du membre
        console.log('📝 Création enregistrement Epargne (retrait)...');
        await tx.epargne.create({
          data: {
            compte,
            typeOperation: TypeOperationEpargne.retrait,
            devise: devise as Devise,
            montant,
            dateOperation: dateO,
            description,
          },
        });

        console.log('📝 Création enregistrement Retrait...');
        const retraitRecord = await tx.retrait.create({
          data: {
            compte,
            devise: devise as Devise,
            montant,
            dateOperation: dateO,
            description,
            soldeAvant: soldeActuel,
            soldeApres: soldeApres,
            frais,
          },
        });

        // 2. Enregistrer le revenu de retrait si des frais sont appliqués
        if (frais > 0) {
          const revType = await tx.revenuType.findFirst({
            where: { nom: 'Système Retrait' },
          });

          if (revType) {
            console.log('📝 EnregistrementRevenu (frais retrait)...');
            // 2.1 Enregistrement dans la table Revenu (Nouvelle architecture)
            await tx.revenu.create({
              data: {
                typeCompte: membre.typeCompte,
                typeRevenuId: revType.id,
                montant: frais,
                devise: devise as Devise,
                dateOperation: dateO,
                sourceCompte: compte,
              },
            });

            // 2.2 Enregistrement sur le compte de REVENUS de la section
            const sectionTrigram = getSectionTrigram(membre.typeCompte);
            const revenueAccount = `MW-${sectionTrigram}-REVENUS`;

            console.log('📝 Création Epargne (frais section):', revenueAccount);
            await tx.epargne.create({
              data: {
                compte: revenueAccount,
                typeOperation: 'depot',
                devise: devise as Devise,
                montant: frais,
                dateOperation: dateO,
                description: `Frais retrait membre ${compte}`,
              },
            });

            // 2.3 Enregistrement sur le compte REVENUS GLOBAL
            console.log('📝 Création Epargne (frais global)');
            await tx.epargne.create({
              data: {
                compte: 'MW-REVENUS-GLOBAL',
                typeOperation: 'depot',
                devise: devise as Devise,
                montant: frais,
                dateOperation: dateO,
                description: `Frais retrait membre ${compte} (via ${membre.typeCompte})`,
              },
            });
          } else {
            console.warn('⚠️  RevenuType "Système Retrait" non trouvé');
          }
        }

        return retraitRecord;
      });

      console.log('✅ Retrait créé avec succès:', retrait);
      return retrait;
    } catch (error: any) {
      console.error(
        '❌ Erreur lors de la création du retrait:',
        error.message || error,
      );
      throw error;
    }
  }

  async findAll() {
    return this.prisma.retrait.findMany({
      include: { membre: { select: { nomComplet: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCompte(compte: string) {
    return this.prisma.retrait.findMany({
      where: { compte },
      include: { membre: { select: { nomComplet: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
