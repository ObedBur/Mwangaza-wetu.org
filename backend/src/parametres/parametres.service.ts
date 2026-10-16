import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateParametreDto } from './dto/update-parametre.dto';
import axios from 'axios';

export interface GeneralParameters {
  solde_min_fc: number;
  solde_min_usd: number;
  montant_min_retrait_fc: number;
  montant_min_retrait_usd: number;
  montant_min_depot_fc?: number;
  montant_min_depot_usd?: number;
  limite_retrait_jour_fc: number;
  limite_retrait_jour_usd: number;
  max_retraits_par_jour: number;
  montant_max_par_retrait_fc: number;
  montant_max_par_retrait_usd: number;
  taux_usd_cdf: number;
  heures_autorisees: { debut: string; fin: string };
  motif_obligatoire: boolean;
  retraits?: {
    frais_retrait?: {
      [devise: string]: { max: number; taux: number }[];
    };
  };
}

@Injectable()
export class ParametresService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.parametreEpargne.findMany({
      orderBy: { nomParametre: 'asc' },
    });
  }

  async findByName(nom: string) {
    const param = await this.prisma.parametreEpargne.findUnique({
      where: { nomParametre: nom },
    });

    // Si c'est le paramètre principal et qu'il est absent, on l'initialise
    if (!param && nom === 'parametres_generaux') {
      const defaults = await this.getGeneralParameters();
      return this.prisma.parametreEpargne.create({
        data: {
          nomParametre: 'parametres_generaux',
          valeur: JSON.stringify(defaults),
          description: 'Initialisation automatique des paramètres généraux',
        },
      });
    }

    if (!param) throw new NotFoundException(`Paramètre ${nom} non trouvé`);
    return param;
  }

  async update(nom: string, dto: UpdateParametreDto) {
    const param = await this.prisma.parametreEpargne.findUnique({
      where: { nomParametre: nom },
    });
    if (!param) throw new NotFoundException(`Paramètre ${nom} non trouvé`);

    return this.prisma.parametreEpargne.update({
      where: { nomParametre: nom },
      data: {
        valeur: dto.valeur,
        description: dto.description,
      },
    });
  }

  async getValeur(nom: string, defaultValue?: string): Promise<string> {
    try {
      const param = await this.prisma.parametreEpargne.findUnique({
        where: { nomParametre: nom },
      });
      return param ? param.valeur : (defaultValue ?? '');
    } catch {
      return defaultValue ?? '';
    }
  }

  /**
   * Récupère le taux de change actuel via une API externe
   * Note: En RDC, le taux parallèle peut différer du taux officiel.
   */
  async syncExchangeRate(): Promise<number> {
    try {
      // Utilisation d'une API de change public (ex: exchangerate-api)
      const response = await axios.get(
        'https://api.exchangerate-api.com/v4/latest/USD',
      );
      const rate = response.data.rates.CDF;

      if (rate) {
        const params = await this.getGeneralParameters();
        params.taux_usd_cdf = rate;

        await this.prisma.parametreEpargne.upsert({
          where: { nomParametre: 'parametres_generaux' },
          update: {
            valeur: JSON.stringify(params),
            description: `Mise à jour automatique du taux : 1 USD = ${rate} CDF`,
          },
          create: {
            nomParametre: 'parametres_generaux',
            valeur: JSON.stringify(params),
            description: `Mise à jour automatique du taux : 1 USD = ${rate} CDF`,
          },
        });

        return rate;
      }
      return 0;
    } catch (error) {
      console.error(
        'Erreur lors de la synchronisation du taux:',
        error.message,
      );
      return 0;
    }
  }

  async getGeneralParameters(): Promise<GeneralParameters> {
    const val = await this.getValeur('parametres_generaux');
    if (!val) {
      // Return defaults if not in DB
      return {
        solde_min_fc: 10000,
        solde_min_usd: 5,
        montant_min_retrait_fc: 5000,
        montant_min_retrait_usd: 5,
        limite_retrait_jour_fc: 50000000,
        limite_retrait_jour_usd: 5000000,
        max_retraits_par_jour: 5,
        montant_max_par_retrait_fc: 500000,
        montant_max_par_retrait_usd: 500,
        taux_usd_cdf: 2217.268,
        heures_autorisees: { debut: '08:00', fin: '22:00' },
        motif_obligatoire: true,
        retraits: {
          frais_retrait: {
            FC: [
              { max: 50000, taux: 0.03 },
              { max: 500000, taux: 0.025 },
              { max: 999999999, taux: 0.02 },
            ],
            USD: [
              { max: 50, taux: 0.03 },
              { max: 500, taux: 0.025 },
              { max: 999999, taux: 0.02 },
            ],
          },
        },
      };
    }
    try {
      const parsed = JSON.parse(val) as GeneralParameters;
      // S'assurer que le taux existe même si le JSON est ancien
      if (!parsed.taux_usd_cdf) parsed.taux_usd_cdf = 2217.268;
      return parsed;
    } catch {
      // Fallback if parsing fails
      return { taux_usd_cdf: 2217.268 } as GeneralParameters;
    }
  }
}
