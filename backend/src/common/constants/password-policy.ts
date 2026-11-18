/**
 * Politique de mot de passe commune à toutes les créations, activations et
 * réinitialisations. Le plafond de 72 octets correspond à la limite au-delà
 * de laquelle bcrypt tronque silencieusement l'entrée.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
/** Coût bcrypt commun (10 est trop faible pour des hashes exposés). */
export const BCRYPT_ROUNDS = 12;
