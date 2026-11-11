# Relais ZKTeco Windows

Le backend reste hébergé sur Render. Ce relais tourne sur le PC Windows du bureau, lit le terminal sur le réseau local, puis échange les pointages et les commandes avec Render par HTTPS. Il ne faut ouvrir aucun port entrant sur la HomeBox.

## Configuration Render

Dans les variables d'environnement du service backend Render, définir :

- `ZKTECO_MODE=bridge`
- `ZKTECO_AGENT_TOKEN` : secret aléatoire d'au moins 32 caractères, à garder privé
- `ZKTECO_COMMAND_TIMEOUT=45000`

Render applique les migrations Prisma au démarrage avant de lancer l'API. Renseignez donc `DIRECT_URL` dans les variables du service.

## Installation sur le PC Windows

1. Installer Bun et récupérer la dernière version du dépôt.
2. Dans `backend`, créer un fichier `.env` local (ne pas le commiter) avec les valeurs suivantes :

```env
ZKTECO_IP=ADRESSE_IP_DU_TERMINAL
ZKTECO_PORT=4370
ZKTECO_TIMEOUT=10000
ZKTECO_INPORT=4000
ZKTECO_CAPTURE_TIMEOUT=30000
ZKTECO_MODE=local
ZKTECO_SERVER_URL=https://URL-PUBLIQUE-DU-BACKEND-RENDER
ZKTECO_AGENT_TOKEN=LE_MEME_SECRET_QUE_DANS_RENDER
ZKTECO_AGENT_POLL_MS=15000
```

3. Vérifier que le PC et le terminal sont reliés au même réseau HomeBox et que l'adresse IP du terminal est réservée dans la HomeBox.
4. Depuis le dossier `backend`, démarrer manuellement avec `bun run zkteco:agent`. Le terminal doit apparaître dans les logs comme connecté et les pointages sont envoyés automatiquement.
5. Une fois la vérification faite, créer une tâche Windows dans le Planificateur de tâches : déclencheur **Au démarrage**, action `bun run zkteco:agent`, démarrer dans le dossier `backend`, et activer le redémarrage en cas d'échec. Désactiver la mise en veille du PC.

Le relais envoie les nouveaux numéros de séquence de pointage et conserve son curseur dans `zkteco-agent-state.json`. Après une coupure réseau, il reprend au dernier pointage confirmé par le backend. Il re-synchronise les logs disponibles si le compteur de l'appareil repart après un effacement.

## Déploiement et contrôle

Déployer le schéma Prisma et le backend Render, puis lancer le relais Windows. Le secret doit être strictement identique côté Render et côté PC. Ne pas exposer les ports 4370 ou 4000 sur Internet et ne pas envoyer le fichier `.env` ou le jeton dans les logs.

Le backend Render actuellement défini dans `render.yaml` est sur l'instance gratuite ; Render peut le mettre en veille après 15 minutes sans requêtes entrantes. Le relais envoie un heartbeat périodique, mais l'instance gratuite peut tout de même redémarrer ou être suspendue selon les limites de l'offre.
