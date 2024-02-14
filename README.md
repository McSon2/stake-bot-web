# Stake-Bot-Web

## Introduction

Ce projet est un système de suivi de paris pour stake.com, permettant aux utilisateurs de suivre les paris d'autres utilisateurs en temps réel, de voir les statistiques des parieurs, et bien plus encore. Il comprend une interface web et des notifications pour les mises à jour des paris.

## Fonctionnalités

- Suivi des paris en temps réel.
- Affichage des statistiques et graphiques des utilisateurs.
- Notifications des mises à jour des paris.

## Installation

Pour installer ce bot sur votre machine, suivez les étapes ci-dessous :

1. Clonez ce dépôt sur votre machine locale :

   ```
   git clone https://github.com/McSon2/stake-bot-web
   ```

2. Dans le répertoire du projet, installez les dépendances en exécutant :
   ```
   npm install
   ```

## Configuration

Avant de lancer votre application, vous devez configurer quelques variables d'environnement essentielles pour la sécurité et les fonctionnalités de notification. Suivez ces étapes pour générer vos clés VAPID et un `SESSION_SECRET` sécurisé.

### Générer des clés VAPID

Les clés VAPID sont utilisées pour authentifier vos notifications push. Pour générer un ensemble de clés VAPID, vous pouvez utiliser la bibliothèque Web Push pour Node.js. Si vous n'avez pas déjà installé cette bibliothèque, vous pouvez le faire en exécutant :

```bash
npm install web-push -g
```

Après l'installation, générez vos clés VAPID en exécutant :

```bash
web-push generate-vapid-keys
```

Cela affichera quelque chose comme :

```plaintext
=======================================

Public Key:
BO3Z3ZsPIH34Pi39YVvyDh ... (reste de la clé publique)

Private Key:
TGHr5J_DEnbjbUqyD9 ... (reste de la clé privée)

=======================================
```

### Créer un SESSION_SECRET

Le `SESSION_SECRET` est utilisé pour signer la session ID cookie, ce qui est crucial pour la sécurité de l'application web. Vous pouvez générer un secret sécurisé en utilisant Node.js. Ouvrez un terminal et exécutez :

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Cela générera une chaîne aléatoire que vous pourrez utiliser comme votre `SESSION_SECRET`.

### Configurer le fichier .env

Une fois que vous avez vos clés VAPID et votre `SESSION_SECRET`, créez un fichier `.env` à la racine de votre projet en suivant le modèle fourni par le fichier `.env.example`. Remplissez les valeurs générées précédemment pour les variables suivantes :

```plaintext
SESSION_SECRET=<Votre_Session_Secret_Généré>
VAPID_PUBLIC_KEY=<Votre_Clé_Publique_VAPID>
VAPID_PRIVATE_KEY=<Votre_Clé_Privée_VAPID>
```

Remplacez `<Votre_Session_Secret_Généré>`, `<Votre_Clé_Publique_VAPID>`, et `<Votre_Clé_Privée_VAPID>` par les valeurs que vous avez générées.

### Conclusion

Après avoir configuré ces variables d'environnement, votre application est prête à utiliser les notifications push de manière sécurisée. Assurez-vous de ne jamais divulguer votre clé privée VAPID ou votre `SESSION_SECRET`.

## Utilisation

Pour démarrer le bot, exécutez la commande suivante :

```
npm start
```

Cela lancera le bot et la page web sur le port spécifié dans votre configuration.
