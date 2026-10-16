import { IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Devise } from '@prisma/client';

/**
 * Ouverture d'un Dépôt à Terme (§3.2 du dossier fonctionnel).
 *
 * Le taux et le minimum d'ouverture sont LUS EN BASE (parametres_dat)
 * et figés sur le DAT créé : aucune valeur financière n'est reçue du client.
 */
export class CreateDatDto {
  /** Numéro de compte du membre (MW-XXX-XXXXXX) */
  @IsString()
  @IsNotEmpty()
  numeroCompte: string;

  /** Durée du DAT : 1 | 3 | 6 | 12 mois */
  @IsIn([1, 3, 6, 12])
  dureeMois: number;

  /** Devise du placement (FC ou USD) */
  @IsEnum(Devise)
  devise: Devise;

  /** Capital bloqué — contrôlé contre le minimum du barème */
  @IsNumber()
  @Min(1)
  montant: number;

  /** Date d'ouverture (AAAA-MM-JJ). Défaut : aujourd'hui. */
  @IsOptional()
  @IsString()
  dateOuverture?: string;
}

/** Clôture à l'échéance : le membre se présente au guichet (option B). */
export class CloturerDatDto {
  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Annulation d'un DAT — §8.3 : TOUTE opération peut être contrepassée,
 * mais le motif est OBLIGATOIRE et l'opération reste tracée (jamais supprimée).
 */
export class AnnulerDatDto {
  @IsString()
  @IsNotEmpty()
  motif: string;
}
