# Issues à suivre — Rapports et évaluation

> Plan de référence : [`PLAN.md`](./PLAN.md)

Cette liste transforme les phases du plan en tickets de travail cochables. Mettre à jour le statut ici au fur et à mesure. Les issues restent en lecture seule : toute opération financière continue de passer par son écran et son service comptable existants.

## Phase 1 — Synthèse d’activité par période

### RAP-01 — Définir et valider les filtres de rapport

- **Statut** : Terminé
- **Dépendances** : aucune
- **Portée** : définir les périodes prédéfinies et personnalisées, les filtres de devise, et le format de dates partagé par `/rapports` et l’API.
- **Terminé quand** :
  - [x] Les bornes de dates et les périodes invalides sont rejetées avec un message explicite.
  - [x] FC et USD sont toujours séparés.
  - [x] Les choix de filtre sont conservés dans l’URL de la page.

### RAP-02 — Produire les totaux et séries d’activité

- **Statut** : Terminé
- **Dépendances** : RAP-01
- **Portée** : exposer les agrégats de dépôts, retraits, crédits décaissés, remboursements et adhésions par période et devise; garder `/api/rapport` compatible pendant la transition.
- **Terminé quand** :
  - [x] Chaque total peut être vérifié à partir des opérations sources.
  - [x] Les annulations et contrepassations ne gonflent pas les totaux nets.
  - [x] Les réponses API sont agrégées dans PostgreSQL; aucune liste d’opérations complète n’est chargée dans le navigateur.

### RAP-03 — Construire la page Synthèse

- **Statut** : Terminé
- **Dépendances** : RAP-02
- **Portée** : créer `/rapports` avec les filtres communs, indicateurs et tendances; ajouter les états chargement, erreur et vide, puis les liens vers les détails.
- **Terminé quand** :
  - [x] La synthèse correspond à l’API pour les filtres sélectionnés.
  - [x] Aucun montant FC et USD n’est additionné sans conversion documentée.
  - [x] La page ne peut pas créer ou modifier une opération; les liens ouvrent les écrans opérationnels existants.

## Phase 2 — Journal, trésorerie et rapprochement

### RAP-04 — Ajouter les filtres au journal comptable

- **Statut** : Terminé
- **Dépendances** : RAP-01, RAP-03
- **Portée** : permettre de filtrer les écritures par période, section, compte, type et statut, puis d’ouvrir l’opération source.
- **Terminé quand** :
  - [x] Une ligne présente référence, date, libellé, section, devise, débit et crédit.
  - [x] Les opérations annulées et leurs contrepassations restent traçables.
  - [x] L’accès aux données est limité aux rôles d’administration autorisés.

### RAP-05 — Rapprocher les mouvements de caisse

- **Statut** : Terminé
- **Dépendances** : RAP-04
- **Portée** : comparer les dépôts, retraits, remboursements et autres mouvements pertinents avec les mouvements de caisse par agent/guichet et devise.
- **Terminé quand** :
  - [x] Les filtres agent, guichet, période et devise s’appliquent de façon cohérente.
  - [x] Les écarts sont visibles et expliqués par les lignes source; aucun écart n’est masqué par un total global.
  - [x] Les statuts annulés ou échoués sont distingués des mouvements effectués.

### RAP-06 — Exporter le journal filtré

- **Statut** : Terminé
- **Dépendances** : RAP-04, RAP-05
- **Portée** : ajouter PDF et CSV/Excel pour le journal et le rapprochement, en reprenant les filtres appliqués.
- **Terminé quand** :
  - [x] L’export contient la période, les filtres, la devise, la page exportée et la date de génération.
  - [x] Les lignes et totaux exportés correspondent aux résultats affichés pour les filtres appliqués.

## Phase 3 — Épargne, crédits et retards

### RAP-07 — Rapporter l’épargne par produit

- **Statut** : Terminé
- **Dépendances** : RAP-01, RAP-03
- **Portée** : ventiler dépôts, retraits et DAT par produit/section et devise; séparer clairement fonds dus aux membres et revenus de la coopérative.
- **Terminé quand** :
  - [x] Les produits d’épargne, retraits et DAT sont identifiables séparément.
  - [x] Les sommes des détails réconcilient les totaux de la synthèse pour les dépôts et retraits.
  - [x] Les dépôts des membres ne sont pas étiquetés comme bénéfice ou revenu.

### RAP-08 — Rapporter le portefeuille de crédits

- **Statut** : Terminé
- **Dépendances** : RAP-01, RAP-03
- **Portée** : afficher crédit accordé, total à rembourser, remboursements valides, restant dû, échéance et statut par devise.
- **Terminé quand** :
  - [x] Les remboursements annulés/supprimés sont exclus du montant remboursé.
  - [x] Les crédits soldés ne sont pas comptés comme encours ou impayés.
  - [x] Les montants suivent les règles métier du backend.

### RAP-09 — Signaler les échéances et retards

- **Statut** : Terminé
- **Dépendances** : RAP-08
- **Portée** : regrouper les échéances à venir et les impayés par ancienneté (1–30, 31–60, 61–90, plus de 90 jours) et permettre d’ouvrir le membre ou le parcours de remboursement.
- **Terminé quand** :
  - [x] Le retard repose sur l’échéance et le solde restant, pas uniquement sur un libellé de statut.
  - [x] Les totaux par tranche et devise correspondent aux crédits détaillés.
  - [x] Les liens ouvrent les écrans existants sans créer de remboursement depuis le rapport.

## Phase 4 — Résultat comptable et évaluation

### RAP-10 — Afficher la balance et le compte de résultat

- **Statut** : Implémenté — rapprochement sur données réelles à faire
- **Dépendances** : RAP-04, RAP-07
- **Portée** : intégrer les états comptables existants par période, devise et section analytique, en permettant de consulter les comptes et écritures de détail.
- **Terminé quand** :
  - [x] La balance affiche l’égalité débits/crédits par devise et signale aussi une période vide.
  - [x] Le compte de résultat est calculé depuis les comptes comptables de charges et produits.
  - [x] L’épargne des membres reste hors des produits de la coopérative.
  - [x] Le filtre de section est appliqué aux deux états et un compte ouvre les écritures du journal.
  - [x] Exports PDF/CSV de la balance et du résultat avec période, section et date de génération.
  - [ ] Rapprocher les totaux avec un jeu d’écritures réel connu.

  **Correction technique** : les périodes comptables utilisent maintenant des bornes UTC inclusives par jour (borne de fin exclusive) et valident les dates; le compte de résultat sélectionne les comptes par leur nature comptable `CHARGE`/`PRODUIT`. La vérification avec les écritures de la coopérative reste à faire.

  **Vérifications automatisées** : test unitaire des bornes UTC, rejet des dates invalides, filtre analytique et calcul produits/charges par nature; compilation backend réussie.

### RAP-11 — Définir les indicateurs et comparaisons

- **Statut** : Implémenté — définitions à valider avec la coopérative
- **Dépendances** : RAP-02, RAP-05, RAP-09, RAP-10
- **Portée** : définir avec la coopérative les indicateurs d’évaluation, leurs formules, sources, dénominateurs et périodes de comparaison.
- **Terminé quand** :
  - [x] Chaque indicateur affiche sa définition, sa période, sa devise et sa source.
  - [x] Les périodes comparées ont la même durée; une valeur précédente nulle est signalée sans calcul de pourcentage.
  - [x] Les métriques opérationnelles sont séparées des états comptables.
  - [ ] Faire valider les définitions (dépôts, décaissements, remboursements et adhésions) par la coopérative.

  **Vérifications automatisées** : test unitaire de la comparaison avec une période précédente de même durée et du cas où la période précédente est nulle (pourcentage non calculé).

### RAP-12 — Exporter et valider les états d’évaluation

- **Statut** : Partiellement implémenté — validation des données à faire
- **Dépendances** : RAP-10, RAP-11
- **Portée** : exporter les états et indicateurs filtrés, puis vérifier les calculs avec des périodes et opérations connues.
- **Terminé quand** :
  - [x] PDF/CSV des états comptables et indicateurs reprend période, filtres et date de génération.
  - [ ] Les calculs sont rapprochés des endpoints comptables et du détail source.
  - [x] Les états de chargement, erreur, absence de données et accès refusé sont gérés dans le code.
  - [ ] Vérifier les états et exports sur un environnement de développement connecté à des données connues.

  **Prochaine validation** : choisir avec la coopérative une période réellement clôturée et relever les totaux attendus du journal et du grand livre, par devise et section. Comparer ensuite écran, CSV et PDF. L’issue reste ouverte jusqu’à cette comparaison documentée.

  **Vérifications automatisées** : 25 suites backend passées (80 tests); build de production frontend réussi, TypeScript compris. Aucune validation d’écran/CSV/PDF sur des chiffres réels n’est revendiquée.

## Dépendances résumées

- RAP-01 → RAP-02 → RAP-03
- RAP-03 → RAP-04 → RAP-05 → RAP-06
- RAP-03 → RAP-07
- RAP-03 → RAP-08 → RAP-09
- RAP-04 et RAP-07 → RAP-10 → RAP-11 → RAP-12
