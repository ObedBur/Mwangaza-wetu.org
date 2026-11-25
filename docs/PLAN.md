# Plan : Rapports et évaluation de la coopérative

> PRD source : besoin décrit dans la conversation du 18 novembre 2026. Aucun `docs/PRD.md` n’est présent dans le dépôt.

## Décisions architecturales

Décisions durables qui s’appliquent à toutes les phases :

- **Routes frontend** : écran principal `/rapports`, avec filtres conservés dans l’URL afin de pouvoir partager ou retrouver une période et une vue.
- **Routes API métier** : compléter les rapports sous `/api/rapports/*`. Garder `/api/rapport` fonctionnel pendant la transition et documenter sa compatibilité.
- **Routes API comptables** : conserver les états comptables sous `/api/comptabilite/*` (`journal`, `grand-livre`, `balance`, `compte-resultat`) et les réutiliser plutôt que de recalculer les soldes comptables dans le frontend.
- **Sources** : utiliser les opérations financières et leurs écritures comptables comme sources de vérité. Les tables métier (`Epargne`, `Retrait`, `Credit`, `Remboursement`, `Dat`, mouvements de caisse) servent aux vues détaillées par produit, membre et agent.
- **Modèles clés** : `Operation`, `EcritureComptable`, `Compte`, `PlanCompte`, `CodeAnalytique`, `Epargne`, `Retrait`, `Credit`, `Remboursement`, `Dat` et mouvements de caisse.
- **Schéma** : ne pas ajouter de tables de rapport ni de snapshots tant que les agrégations requises restent calculables depuis les écritures. Toute évolution de schéma doit avoir une migration compatible avec les données existantes.
- **Authentification** : rapports réservés aux rôles d’administration via `ADMIN_ROLES`; les agents ne voient que les rapports autorisés pour leurs guichets si cette portée est ajoutée ultérieurement.
- **Devises** : afficher FC et USD séparément. Ne jamais les additionner ou présenter une consolidation sans taux de change, date de taux et règle de conversion explicites.
- **Périmètre fonctionnel** : la page est en lecture seule. Les dépôts, retraits, décaissements et remboursements continuent de passer par leurs écrans et services comptables existants.
- **Exports** : suivre les filtres et la portée visibles à l’écran; indiquer la période, la devise et la date de génération sur chaque export.

---

## Phase 1 : Synthèse d’activité par période

**User stories** : US-1, US-2

### Ce qu'on livre

Un administrateur choisit une période et une devise puis consulte une synthèse d’activité issue des données réelles : dépôts, retraits, crédits décaissés, remboursements et adhésions. L’écran montre les montants séparément en FC et USD, les tendances par période et les liens vers les opérations détaillées. L’API valide les bornes de dates et les filtres; l’interface présente les états de chargement, vide et erreur.

### Critères d'acceptation

- [x] L’écran `/rapports` propose période prédéfinie et personnalisée, devise, granularité, et filtres disponibles sans rechargement complet.
- [x] L’API renvoie des totaux agrégés et séries datées correspondant aux opérations enregistrées dans la période sélectionnée.
- [x] FC et USD ne sont jamais additionnés dans une valeur unique.
- [x] Les opérations annulées sont identifiées et ne gonflent pas les totaux nets; leur traitement suit les contrepassations comptables existantes.
- [x] Les filtres invalides ou les périodes inversées renvoient une erreur exploitable.
- [x] L’écran reste en lecture seule et les valeurs sont vérifiables en ouvrant les écrans opérationnels sources.

## Bloquée par

Aucune — démarrable immédiatement.

---

## Phase 2 : Journal, trésorerie et rapprochement

**User stories** : US-3, US-4

### Ce qu'on livre

Depuis la synthèse, l’administrateur ouvre un journal détaillé filtrable par dates, section, compte, type et statut. Il consulte les mouvements de caisse et rapproche les totaux opérationnels avec le journal comptable. Les lignes permettent de remonter à l’opération d’origine; PDF/CSV exporte exactement le jeu filtré.

### Critères d'acceptation

- [x] Le journal affiche référence, date, libellé, section, statut, devise, débit et crédit, selon les écritures comptabilisées.
- [x] Le total filtré par devise correspond aux lignes visibles et aux données de l’API.
- [x] Les mouvements de caisse peuvent être filtrés par guichet/agent et comparés aux opérations correspondantes.
- [x] Les écritures annulées et leurs contrepassations restent traçables sans être présentées comme des opérations nettes actives.
- [x] Les exports PDF/CSV reprennent la période, les filtres, la devise et les totaux de la vue affichée.
- [x] Un utilisateur sans rôle autorisé ne peut pas appeler les endpoints de rapport ou de rapprochement.

## Bloquée par

- Phase 1 — réutilisation des filtres de période et de la navigation depuis la synthèse.

---

## Phase 3 : Épargne, crédits et retards

**User stories** : US-5, US-6

### Ce qu'on livre

Un rapport de portefeuille permet d’examiner l’épargne par produit/section et le portefeuille de crédits par statut et échéance. L’administrateur distingue capital prêté, montant remboursé, solde restant et retards par ancienneté; il peut ouvrir la fiche du membre ou l’écran de remboursement existant. Les alertes de crédit s’appuient sur les mêmes règles de solde restant et de date que la fiche membre.

### Critères d'acceptation

- [x] Le rapport distingue dépôts membres, retraits, DAT et sommes liées aux crédits; les revenus de la coopérative ne sont pas confondus avec les dépôts des membres.
- [x] Pour chaque crédit, montant dû, remboursements et solde restant utilisent les règles métier du backend.
- [x] Les échéances à venir et impayées sont regroupées par devise et par tranches de retard configurées (1–30, 31–60, 61–90 et plus de 90 jours).
- [x] Les crédits soldés ne sont pas comptés comme impayés; les remboursements annulés/supprimés sont exclus des paiements valides.
- [x] Les liens ouvrent les écrans métier existants sans créer d’opération depuis le rapport.
- [x] Les totaux par devise se réconcilient avec le détail filtré.

## Bloquée par

- Phase 1 — filtres communs de période et de devise.

---

## Phase 4 : Résultat comptable et évaluation

**User stories** : US-7, US-8

### Ce qu'on livre

La page rassemble les états comptables existants — balance et compte de résultat — avec une vue d’évaluation lisible : produits, charges, résultat par devise, comparaison avec la période précédente et définitions des indicateurs. L’administrateur peut filtrer par section analytique, inspecter les comptes composant les chiffres et exporter la période. Les indicateurs opérationnels restent distincts des états comptables.

### Critères d'acceptation

- [x] La balance affiche par devise si débits et crédits sont équilibrés pour la période et la section; une période sans écritures est indiquée comme vide.
- [x] Le compte de résultat utilise les comptes comptables de charges et produits; l’épargne des membres n’est pas présentée comme revenu.
- [x] FC et USD sont présentés séparément; les indicateurs comparent des périodes de même durée.
- [x] Chaque indicateur affiche formule, période, devise et source; une période précédente à zéro affiche « sans base de comparaison ».
- [x] Les filtres analytiques sont transmis aux endpoints de balance et de résultat; un compte de la balance ouvre son journal détaillé.
- [x] Les exports CSV/PDF des états et de l’évaluation incluent filtres/période et date de génération.

**Validation restante** : contrôler balance, compte de résultat et exports sur un jeu réel connu avant de considérer les montants métier certifiés. Pour ce rapprochement, utiliser une période et une section identifiables, comparer séparément FC et USD aux écritures validées du journal, puis vérifier que les fichiers exportés reprennent les mêmes filtres et totaux. Ne pas utiliser de données inventées pour marquer cette validation terminée.

**Vérifications techniques réalisées** : compilation backend réussie; tests backend réussis (25 suites, 80 tests); build de production frontend réussi, y compris TypeScript et génération des 33 pages. Ces vérifications valident le code et les tests automatisés, mais ne remplacent pas le rapprochement avec les chiffres réels.

## Bloquée par

- Phase 2 — journal et rapprochement disponibles pour l’audit des résultats.
- Phase 3 — indicateurs de portefeuille et de retards disponibles pour l’évaluation globale.

---

## Récit utilisateur retenu pour ce plan

- **US-1** : En tant qu’administrateur, je veux choisir une période et une devise afin de lire l’activité de la coopérative sans mélanger les monnaies.
- **US-2** : En tant qu’administrateur, je veux comprendre l’évolution des dépôts, retraits, crédits, remboursements et adhésions.
- **US-3** : En tant qu’administrateur, je veux consulter le journal détaillé derrière chaque total.
- **US-4** : En tant que responsable, je veux rapprocher les mouvements de caisse avec les écritures comptables et exporter le résultat.
- **US-5** : En tant qu’administrateur, je veux analyser l’épargne par produit sans la confondre avec les revenus de la coopérative.
- **US-6** : En tant que responsable crédit, je veux voir les soldes dus et l’ancienneté des impayés afin de prioriser le suivi.
- **US-7** : En tant que responsable, je veux lire la balance et le compte de résultat par période, devise et section.
- **US-8** : En tant que direction, je veux comparer des indicateurs clairement définis entre périodes afin d’évaluer les résultats.
