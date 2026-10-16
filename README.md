# Mwangaza Wetu

Application de gestion des membres, de l'epargne, des credits et des operations associees.

Ce depot prive regroupe le frontend et le backend de Mwangaza Wetu. Ce guide est destine aux personnes autorisees a travailler sur le projet.

## Structure

- `frontend/` : application web Next.js, servie en developpement sur le port `5000`.
- `backend/` : API NestJS et schema Prisma, servie sur le port `4000` par defaut.
- `backend/prisma/` : schema de la base de donnees et migrations.

## Prerequis

- Bun `1.4.2` (version declaree par le projet).
- Une base de donnees PostgreSQL accessible.
- Git et un terminal.

## Installation

Depuis la racine du depot :

```bash
bun install
```

## Configuration locale

Creer `backend/.env` et y renseigner les valeurs de votre environnement :

```dotenv
DATABASE_URL="postgresql://UTILISATEUR:MOT_DE_PASSE@HOTE:5432/NOM_BASE?schema=public"
JWT_SECRET="REMPLACER_PAR_UNE_CLE_ALEATOIRE_LONGUE"
FRONTEND_URL="http://localhost:5000"
PORT=4000
CLOUDINARY_CLOUD_NAME="votre-cloud-name"
CLOUDINARY_API_KEY="votre-api-key"
CLOUDINARY_API_SECRET="votre-api-secret"
```

Le frontend utilise par defaut `http://localhost:4000/api`. Pour changer l'adresse de l'API, definir `NEXT_PUBLIC_API_URL` dans `frontend/.env.local`, par exemple :

```dotenv
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
```

L'envoi d'e-mails est facultatif. Pour l'activer, configurer `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` et, si necessaire, `MAIL_SECURE` dans `backend/.env`.

> **Securite :** ne jamais ajouter de vrais mots de passe, cles JWT, identifiants de base de donnees ou fichiers `.env` au depot. Demander les valeurs de configuration a la personne responsable de l'environnement.

## Demarrage

Depuis la racine, lancer le frontend et le backend en mode developpement :

```bash
bun run dev
```

Ou lancer chaque application separement :

```bash
bun run dev:backend
bun run dev:frontend
```

Adresses locales :

- Frontend : `http://localhost:5000`
- API backend : `http://localhost:4000/api`

Le backend respecte la variable `PORT` lorsqu'elle est definie. En deploiement, l'URL autorisee par CORS doit etre renseignee dans `FRONTEND_URL`.

## Base de donnees

Apres avoir configure `DATABASE_URL`, generer le client Prisma :

```bash
bun run prisma:generate
```

Pour appliquer les migrations existantes en local :

```bash
cd backend
bunx prisma migrate deploy
```

> `bun run prisma:migrate` lance `prisma migrate dev` et sert au developpement. Ne pas utiliser cette commande pour appliquer des migrations en production.

## Commandes utiles

Toutes les commandes suivantes s'executent depuis la racine :

| Commande | Action |
| --- | --- |
| `bun run dev` | Lance les deux applications en mode developpement. |
| `bun run build` | Compile le backend et le frontend. |
| `bun run lint` | Lance le lint sur les deux applications. |
| `bun run test` | Lance les tests unitaires du backend. |
| `bun run test:e2e` | Lance les tests end-to-end du backend. |
| `bun run prisma:generate` | Genere le client Prisma. |

## Deploiement

Le frontend Next.js est deploye sur Vercel et l'API NestJS sur Render. Le fichier `render.yaml` configure le service backend uniquement.

### 1. Deployer le backend sur Render

1. Connecter le depot prive a Render et creer le service backend a partir du Blueprint `render.yaml` (ou creer un service Web Node avec `backend` comme repertoire racine).
2. Creer ou choisir une base PostgreSQL accessible depuis le service Render.
3. Renseigner les variables d'environnement du backend :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | URL de connexion PostgreSQL de production. |
| `JWT_SECRET` | Secret aleatoire et prive pour signer les jetons. |
| `FRONTEND_URL` | Origine Vercel, par exemple `https://mwangaza-wetu.vercel.app` (sans chemin ni `/api`). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Identifiants Cloudinary requis pour enregistrer les photos. |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | Variables facultatives pour activer l'envoi d'e-mails. |

Render fournit la variable `PORT` au service ; le backend l'utilise automatiquement. Avant la premiere utilisation, appliquer les migrations existantes. Dans le Shell du service backend sur Render (repertoire courant `backend`) :

```bash
bunx prisma migrate deploy
```

En local, depuis la racine du depot :

```bash
cd backend && bunx prisma migrate deploy
```

### 2. Deployer le frontend sur Vercel

1. Importer le meme depot dans Vercel et choisir `frontend` comme **Root Directory**. Utiliser le preset Next.js.
2. Definir `NEXT_PUBLIC_API_URL` dans les variables d'environnement Vercel :

```text
https://NOM-DU-SERVICE.onrender.com/api
```

3. Ajouter la variable aux environnements **Production** et **Preview** selon les besoins, puis deployer ou redployer le frontend.
4. Copier l'origine du site Vercel (sans chemin) dans `FRONTEND_URL` sur Render, puis redemarrer ou redeployer le backend.

`FRONTEND_URL` accepte plusieurs origines separees par des virgules. Les URLs de preview Vercel ne seront pas autorisees par CORS tant qu'elles ne sont pas ajoutees a cette variable. Pour une configuration plus stable, utiliser un domaine de production Vercel fixe.

> Toute variable `NEXT_PUBLIC_*` est integree au code client lors de la compilation et devient visible dans le navigateur. Ne jamais y placer de secret. Ne pas commiter de secrets Render, de variables Vercel privees ni de fichiers `.env`.
