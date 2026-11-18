# Sécurité de l'authentification

Ce document décrit les mécanismes en place côté backend et frontend. Il sert
de référence d'exploitation : que surveiller, quels réglages sont attendus en
production, et quelles migrations appliquer.

## 1. Politique de mot de passe

Source unique : `backend/src/common/constants/password-policy.ts`.

| Règle | Valeur |
| --- | --- |
| Longueur minimale | 8 caractères |
| Longueur maximale | 72 octets (limite bcrypt, au-delà le hash tronque) |
| Coût bcrypt | 12 |

Tous les DTO de création, mise à jour, activation et changement de mot de
passe utilisent `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_LENGTH`. Aucun
contrôle `MinLength(6)` ne doit subsister ailleurs.

## 2. Verrouillage de compte

- 10 échecs dans une fenêtre glissante de 15 minutes verrouillent le compte
  15 minutes (`MAX_LOGIN_FAILURES`, `LOGIN_FAILURE_WINDOW_MS`,
  `LOCK_DURATION_MS` dans `auth.service.ts`).
- Un déverrouillage manuel est possible via `POST /api/auth/unlock`
  (`admin` / `superadmin`, corps `{ role, id }`).
- Un changement de mot de passe réussi remet les compteurs d'échec à zéro.

## 3. Limitation de débit

Tous les compteurs vivent dans **Redis** (`RateLimitService`) avec repli
mémoire si Redis est absent ou momentanément indisponible. Aucune tentative
non authentifiée n'écrit plus dans PostgreSQL.

| Bucket | Clé | Limite |
| --- | --- | --- |
| Connexion par IP | `login:ip:<ip>` | 50 / 15 min |
| Connexion par IP + identifiant | `login:id:<ip>:<sha256>` | 6 / 15 min |
| Changement de mot de passe | `pwd-change:<role>:<userId>` | 5 / 15 min |

Une réponse limitée est un `429` avec l'en-tête `Retry-After`.

La connexion réussie ne purge que le bucket `(IP, identifiant)` concerné et
décrémente le bucket global de l'IP : les échecs visant d'autres comptes
restent comptabilisés.

La table `login_attempts` n'est plus alimentée. `LoginAttemptsCleanupService`
continue de purger les lignes héritées une fois par heure (rétention 24 h) ;
elle peut être supprimée quand la table est vide et l'ancien code retiré.

## 4. Audit des connexions

`AuthAuditService` écrit dans `admin_logs` (best-effort : une panne d'audit ne
bloque jamais une connexion) :

- `LOGIN_SUCCESS`
- `LOGIN_FAILED` (motif + empreinte SHA-256 tronquée de l'identifiant)
- `ACCOUNT_LOCKED`
- `LOGOUT`
- `*_PASSWORD_CHANGED` (membre, agent, administrateur)

L'adresse IP est renseignée via `AdminLog.ipAddress`. L'identifiant n'est
jamais stocké en clair.

## 5. Sessions

- JWT `httpOnly`, `Secure` + `SameSite=None` en production, `Lax` en local.
- Jeton CSRF dans un cookie `httpOnly` séparé, renvoyé dans le corps de la
  réponse de connexion et exigé sur les requêtes mutantes.
- `Cache-Control: no-store` sur toutes les réponses `/api/auth`.
- Déconnexion : le `jti` est inscrit sur une liste de révocation
  (`SessionRevocationService`) en mémoire **et** dans Redis, jusqu'à
  l'expiration du jeton.
- `authVersion` : incrémenté à chaque changement de mot de passe. Le JWT
  porte la version au moment de la connexion ; toute session antérieure est
  rejetée dès la requête suivante, sans attendre l'expiration.

## 6. Redis

- `REDIS_URL` est **obligatoire en production** (le module lève au
  démarrage). En développement, son absence bascule sur les compteurs
  mémoire.
- Reconnexion : backoff exponentiel plafonné à 30 s, tentatives illimitées.
  Une coupure ne fait pas tomber l'application.
- `RedisHealthService` journalise chaque transition disponible →
  indisponible et le retour à la normale.
- `GET /api/health` :
  - `200 {"status":"ok"}` : base et Redis joignables ;
  - `200 {"status":"degraded"}` : base joignable, Redis non (le service
    reste disponible) ;
  - `503 {"status":"error"}` : base injoignable.

  Brancher le superviseur sur le code HTTP : `503` = incident, `degraded`
  doit déclencher une alerte non bloquante.

## 7. CSP

### Backend

`SecurityHeadersMiddleware` pose une CSP sur les réponses du backend. Elle ne
concerne que du JSON et les fichiers `/uploads` ; `img-src` est limité à
`'self' data:` (plus de `https:` générique qui autorisait l'exfiltration par
balise image).

### Frontend (Next.js)

La CSP est générée **par requête** dans `frontend/src/proxy.ts` avec un nonce :

- `script-src 'self' 'nonce-…' 'strict-dynamic'` (plus `'unsafe-eval'` en
  développement) ;
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — les
  attributs `style` de React ne sont pas couverts par un nonce ;
- `img-src 'self' blob: data: https://res.cloudinary.com https://lh3.googleusercontent.com` ;
- `connect-src 'self'` + l'origine de `NEXT_PUBLIC_API_URL` ;
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'`.

Conséquence assumée : le layout racine appelle `connection()`, donc **toutes
les pages sont rendues dynamiquement**. Plus de cache statique ni CDN pour le
HTML ; c'est le prix d'une CSP sans `'unsafe-inline'` sur les scripts. Le
build doit lister toutes les routes en `ƒ` (dynamique).

La CSP n'est plus déclarée dans `next.config.ts` : deux CSP s'appliqueraient
en intersection et bloqueraient les scripts de Next.

## 8. Origines autorisées

`getAllowedOrigins()` (`backend/src/common/config/allowed-origins.ts`) est la
seule source pour CORS et pour le contrôle d'`Origin` du limiteur de
connexion :

- `FRONTEND_URL` accepte une liste séparée par des virgules ;
- `http://localhost:5000` n'est ajouté **que si `NODE_ENV !== 'production'`** ;
- en production, une `FRONTEND_URL` vide fait échouer le démarrage.

## 9. Variables d'environnement

| Variable | Production | Développement |
| --- | --- | --- |
| `JWT_SECRET` | ≥ 32 caractères, non factice (obligatoire) | idem |
| `FRONTEND_URL` | obligatoire | défaut `http://localhost:5000` |
| `REDIS_URL` | obligatoire | optionnel (repli mémoire) |
| `TRUST_PROXY` | `1` derrière un proxy (Render) | vide |
| `DATABASE_URL` | base de production | base locale pour les e2e |

## 10. Migrations

Deux migrations doivent être appliquées avant de déployer ce lot :

```bash
cd backend
npx prisma migrate deploy
```

- `20261116120000_add_login_failure_window` (verrouillage) ;
- `20261118120000_purge_login_attempts_index` (index de purge).

## 11. Tests e2e locaux

```bash
cd backend
cp .env.test.example .env.test.local   # puis renseigner une base locale
npx prisma migrate deploy
npm run test:e2e
```

`test/setup-env.ts` refuse toute `DATABASE_URL` non locale : si la base n'est
pas `localhost` / `127.0.0.1` / `::1`, les tests sont marqués **ignorés**
avec un message explicite, jamais exécutés contre la production.

## 12. Points de vigilance restants

- Surveiller `admin_logs` : une absence prolongée de `LOGIN_SUCCESS` ou une
  rafale de `LOGIN_FAILED` / `ACCOUNT_LOCKED` doit alerter.
- Le repli mémoire de Redis est **par instance** : en cas de panne Redis
  prolongée en production, les quotas redeviennent locaux (N instances = N
  fois la limite). L'alerte `degraded` doit donc être traitée rapidement.
- La CSP à nonce impose le rendu dynamique : si un CDN HTML est ajouté plus
  tard, il devra préserver l'en-tête `Content-Security-Policy` par requête.
