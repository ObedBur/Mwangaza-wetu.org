/**
 * Charte Graphique Officielle Mwangaza Wetu
 * Épargne • Crédit • Développement
 * "Plus qu'une coopérative, une famille"
 */

export const MWANGAZA_PALETTE = {
  // Couleurs principales
  primaryDeep: '#0B5EA8',      // Bleu profond : confiance, stabilité, sécurité, professionnalisme
  primaryMedium: '#1E88E5',    // Bleu moyen : proximité, accessibilité, évolution
  orangeLogo: '#E56A1E',       // Orange : énergie, dynamisme, engagement
  goldAmber: '#D4A017',        // Or / Ambre : prospérité, réussite, croissance
  lightBeige: '#F8F7F5',       // Beige clair : équilibre, clarté, simplicité

  // Couleurs secondaires
  charcoal: '#2D3748',         // Gris anthracite : lisibilité, modernité, contraste
  lightGray: '#E5E7EB',        // Gris clair : structure, fond, bordures
  natureGreen: '#16A34A',      // Vert nature : croissance, espoir, avenir

  // Dégradés officiels
  gradients: {
    blue: 'linear-gradient(135deg, #0B5EA8 0%, #1E88E5 100%)',
    orangeAmber: 'linear-gradient(135deg, #E56A1E 0%, #D4A017 100%)',
    greenBlue: 'linear-gradient(135deg, #16A34A 0%, #0B5EA8 100%)',
    subtleBeige: 'linear-gradient(180deg, #F8F7F5 0%, #FFFFFF 100%)',
  }
} as const;

export const MWANGAZA_BRAND = {
  name: 'Mwangaza Wetu',
  subtitle: 'Mini Coopérative d\'Épargne et de Crédit',
  slogan: 'Plus qu\'une coopérative, une famille',
  pillars: 'Épargne • Crédit • Développement',
  mission: 'Ensemble, nous bâtissons une communauté financière plus forte.',
  vision: 'Ensemble pour un avenir meilleur',
} as const;
