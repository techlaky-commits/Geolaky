# LakyMaps

Application de photos geolocalisees pour visites de site (type SoloCator) :
prise de photo sur mobile (PWA) avec horodatage + position GPS tamponnes sur
l'image, puis organisation et retouche des photos sur la plateforme web par
projet, avec export d'un rapport PDF.

## Stack

- **Next.js 14** (App Router, TypeScript) pour le web ET la capture mobile
  (PWA installable, pas d'app native separee)
- **Prisma** + **SQLite** en local (zero config). Le schema est compatible
  Postgres : pour la prod, changer `provider = "sqlite"` en `"postgresql"`
  dans [prisma/schema.prisma](prisma/schema.prisma) et pointer `DATABASE_URL`
  vers une instance Postgres (Neon, Supabase, RDS...)
- **NextAuth** (credentials + mot de passe hache) pour l'authentification
- **sharp** pour tamponner geoloc/date/heure/adresse directement sur l'image
  (rendu serveur, cote client c'est juste un apercu)
- **react-easy-crop** pour le recadrage/rotation sur la page de retouche
- **pdf-lib** pour generer le rapport PDF d'un projet
- Geocodage inverse (lat/lon -> adresse) via **Nominatim** (OpenStreetMap),
  gratuit mais avec un fort taux de rate-limit - voir limitations plus bas

## Demarrage

```bash
npm install
cp .env.example .env          # ajuster NEXTAUTH_SECRET en prod
npx prisma migrate dev         # cree prisma/dev.db (SQLite)
npm run generate:icons         # genere les icones PWA dans public/icons
npm run dev
```

Ouvrir http://localhost:3000, creer un compte, creer un projet, puis :

- Sur ordinateur : galerie du projet, retouche des photos, export PDF.
- Sur mobile : ouvrir `/capture/<projetId>` (lien "Prendre une photo" depuis
  la page du projet), autoriser la camera + la localisation. La page peut
  etre ajoutee a l'ecran d'accueil (PWA installable).

## Fonctionnement

1. **Capture mobile** (`/capture/[id]`) : ouvre l'appareil photo natif via
   `<input type="file" capture="environment">`, recupere la position GPS en
   continu (`watchPosition`) pour qu'elle soit prete des la prise de vue,
   affiche un apercu avec coordonnees + date/heure, puis envoie la photo au
   serveur.
2. **Traitement serveur** (`POST /api/projects/[id]/photos`) : resout
   l'adresse depuis les coordonnees (Nominatim), puis genere une image
   "tamponnee" (bandeau semi-transparent avec nom du projet, adresse,
   coordonnees, date/heure, note) via `sharp`. L'original ET la version
   tamponnee sont conserves.
3. **Retouche** (`/photos/[id]`) : recadrage/rotation de l'original via
   `react-easy-crop`, edition de l'adresse/note affichees sur le tampon.
   Chaque enregistrement re-genere l'image tamponnee a partir de l'original.
4. **Rapport** (`GET /api/projects/[id]/report`) : PDF avec une page de garde
   et une page par photo (image tamponnee + legende).

Les photos sont stockees hors de `public/` (dossier `storage/`, hors
git) et servies via `/api/files/[...path]`, qui verifie que l'utilisateur
connecte est bien proprietaire du projet avant de renvoyer le fichier.

## Deploiement (Railway)

L'app fonctionne telle quelle (SQLite + stockage fichiers local) sur tout
hebergeur offrant un disque persistant. Etapes pour Railway :

1. Sur [railway.app](https://railway.app), **New Project** -> **Deploy from
   GitHub repo** -> selectionner le repo `Geolaky`. Railway detecte
   automatiquement le projet Next.js (Nixpacks) et lance `npm run build`.
2. Ajouter un **Volume** au service (onglet *Settings* -> *Volumes*), monte
   par exemple sur `/data`.
3. Definir les variables d'environnement du service (*Variables*) :
   - `DATABASE_URL=file:/data/geolaky.db`
   - `STORAGE_DIR=/data/storage`
   - `NEXTAUTH_SECRET=<valeur generee via: openssl rand -base64 32>`
   - `NEXTAUTH_URL=https://<le-domaine-fourni-par-railway>`
   - `NOMINATIM_USER_AGENT=LakyMaps/1.0 (ton-email@exemple.com)`
4. Redeployer si besoin (*Deployments* -> *Redeploy*) une fois les variables
   posees. Le script `start` (`prisma migrate deploy && next start`) applique
   les migrations automatiquement au demarrage.

Les prochains `git push` sur la branche connectee redeploient automatiquement.

## Limitations connues (MVP)

- **Geocodage** : Nominatim impose ~1 requete/seconde et peut repondre 403
  en cas d'usage soutenu ou de tests repetes. L'app reste fonctionnelle sans
  adresse resolue (l'utilisateur peut la saisir manuellement sur la page de
  retouche) ; pour un usage en production a plus fort volume, remplacer
  `src/lib/geocode.ts` par un fournisseur paye (Google/Mapbox) ou une
  instance Nominatim auto-hebergee.
- **Base de donnees** : SQLite en local pour la simplicite. Passer a
  Postgres avant tout deploiement multi-instance (SQLite ne supporte pas
  bien les ecritures concurrentes depuis plusieurs serveurs).
- **Stockage fichiers** : systeme de fichiers local (dossier `storage/`).
  Pour un deploiement sur une plateforme sans disque persistant (Vercel...),
  remplacer `src/lib/storage.ts` par un stockage objet (S3, R2, Supabase
  Storage...).
- Pas de logo/watermark personnalisable, pas de gestion d'equipe/permissions,
  pas de mode hors-ligne avance - hors perimetre du MVP (voir le clone
  complet de SoloCator si besoin plus tard).

## Structure

```
src/
  app/                  pages (App Router) + routes API
  components/           composants client (capture, retouche, formulaires)
  lib/                  prisma, auth, stockage, geocodage, tampon d'image
prisma/schema.prisma    modele de donnees (User, Project, Photo)
public/                 manifest PWA, service worker, icones
storage/                photos uploadees (cree au runtime, hors git)
```
