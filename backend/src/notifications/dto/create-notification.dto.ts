import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Types gérés par la coopérative — alignés sur les catégories du portail
 * membre (Annonces & assemblées) : Assemblée | Information | Service.
 */
export const NOTIFICATION_TYPES = [
  'info',
  'assemblée',
  'service',
  'rappel',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * POST /api/notifications — création côté administration.
 *
 * - `membreId` fourni  => notification ciblée sur CE membre uniquement.
 * - `agentId` fourni   => notification ciblée sur CET agent de guichet.
 * - aucun des deux     => diffusion générale (annonce / convocation
 *                        d'assemblée) visible par les membres ET les agents.
 */
export class CreateNotificationDto {
  /** Membre ciblé. Omis => diffusion générale. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  membreId?: number;

  /** Agent de guichet ciblé. Mutuellement exclusif avec membreId. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  agentId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: NotificationType;
}
