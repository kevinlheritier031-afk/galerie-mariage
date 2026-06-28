# GALERIE MARIAGE — PROMPT COMPLET POUR CLAUDE CODE

Tu vas créer une application web complète appelée "Galerie Mariage"
dans le dossier courant ~/galerie-mariage sur un VPS Ubuntu.
Chaque fichier doit contenir des commentaires en français
expliquant le fonctionnement.
Le code doit être 100% fonctionnel, zéro TODO,
zéro placeholder dans la logique.

---

## Stack technique

- React + Vite
- Tailwind CSS
- Supabase JS SDK connecté au Supabase self-hosted sur ce VPS
- JSZip pour génération ZIP côté navigateur
- qrcode.react pour QR code dans le panel admin
- Vercel Edge Functions pour relais API disque
- Déployable sur Vercel

---

## Variables d'environnement

Créer .env.example avec :

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_SERVICE_KEY=
VITE_ADMIN_PASSWORD=
VITE_DOWNLOAD_CODE=
VITE_APP_URL=
VITE_MAX_VIDEO_DURATION=60
VITE_MAX_VIDEO_SIZE_MB=100
DISK_API_URL=
```

DISK_API_URL est sans VITE_ car utilisé uniquement côté serveur
dans la Vercel Edge Function. Ex: http://141.94.121.159:3001

---

## Build Vite

Dans vite.config.js :
- Supprimer le meta tag generator de l'HTML
- rollupOptions avec chunkFileNames: '[hash].js'
- sourcemap: false en production

---

## Base de données — supabase/schema.sql

```sql
-- Table principale des médias photos et vidéos
-- Chaque ligne est un fichier uploadé par un invité
CREATE TABLE media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pseudo TEXT DEFAULT 'Invité anonyme',
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE media ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire tous les médias
CREATE POLICY "Public read" ON media
  FOR SELECT USING (true);

-- Tout le monde peut uploader sans compte
CREATE POLICY "Public insert" ON media
  FOR INSERT WITH CHECK (true);

-- Suppression uniquement via service_role depuis le panel admin
CREATE POLICY "Service role delete" ON media
  FOR DELETE USING (auth.role() = 'service_role');

-- Table des paramètres globaux
-- Permet de changer le comportement sans redéployer
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Téléchargement libre par défaut pendant la soirée
INSERT INTO settings (key, value) VALUES ('download_mode', 'open');
-- open      = téléchargement libre sans code pendant la soirée
-- protected = code secret requis après la soirée
-- disabled  = téléchargement complètement désactivé

CREATE POLICY "Public read settings" ON settings
  FOR SELECT USING (true);

CREATE POLICY "Service role update settings" ON settings
  FOR UPDATE USING (auth.role() = 'service_role');
```

---

## API disque — disk-api/

Créer disk-api/package.json avec express et cors comme dépendances.

Créer disk-api/server.js :
- Serveur Express sur le port 3001
- Endpoint GET /api/disk-usage
- Utilise child_process exec pour lancer la commande df
- Lit l'espace de /mnt/media-storage et /dev/sda1
- Retourne ce JSON :

```json
{
  "additional": {
    "total_gb": 0,
    "used_gb": 0,
    "available_gb": 0,
    "percent_used": 0,
    "active": true
  },
  "main": {
    "total_gb": 0,
    "used_gb": 0,
    "available_gb": 0,
    "percent_used": 0,
    "active": false
  }
}
```

active = true sur additional si percent_used inférieur à 90.
active = true sur main si additional.percent_used supérieur à 90.
Ajouter cors pour autoriser toutes les origines.
Commenter chaque section en français.

---

## Vercel Edge Function — api/disk-usage.js

Créer api/disk-usage.js à la racine du projet.

```
// Cette Edge Function tourne côté serveur Vercel
// Elle fait le relais entre le panel admin (HTTPS)
// et l'API disque sur le VPS (HTTP)
// Cela évite les erreurs mixed content du navigateur
// qui bloque les appels HTTP depuis une page HTTPS
//
// Le panel admin appelle /api/disk-usage (relatif HTTPS)
// La Edge Function appelle DISK_API_URL (HTTP côté serveur)
// et retourne le résultat au panel admin
```

- Récupère DISK_API_URL depuis les variables d'environnement
- Fetch GET vers DISK_API_URL/api/disk-usage
- Retourne le JSON reçu avec les bons headers CORS
- Si le VPS est inaccessible retourner JSON erreur avec status 503

---

## Structure complète des fichiers

```
src/
  components/
    Gallery.jsx
    MediaCard.jsx
    Lightbox.jsx
    UploadModal.jsx
    SelectionBar.jsx
    DownloadCodeModal.jsx
    AdminPanel.jsx
    VideoPlayer.jsx
  lib/
    supabase.js
    downloadHelpers.js
    mediaValidation.js
  hooks/
    useSettings.js
    useMedia.js
  App.jsx
  main.jsx
api/
  disk-usage.js
disk-api/
  server.js
  package.json
supabase/
  schema.sql
.env.example
README.md
```

---

## Galerie publique route /

Charge tous les médias depuis Supabase au montage.
S'abonne au Realtime Supabase.
Quand un invité uploade, le média apparaît instantanément
chez tout le monde sans refresh.

Grille responsive :
- 3 colonnes desktop
- 2 colonnes tablette
- 1 colonne mobile

Photos affichées directement.
Vidéos avec miniature et icône ▶️ par-dessus.
Clic photo → Lightbox image plein écran navigation gauche droite.
Clic vidéo → Lightbox avec lecteur vidéo HTML5 natif.
Chaque carte affiche pseudo et heure d'upload.
Header "Notre Mariage 💍".
Bouton flottant "📷 Ajouter" fixe en bas à droite 56px minimum.

**Mode sélection :**
Activé par appui long sur mobile ou bouton Sélectionner desktop.
Clic simple = cocher décocher sans ouvrir le lightbox.
Cases à cocher permanentes mobile, au survol desktop.
Compteur de médias sélectionnés affiché en haut.
Boutons Tout sélectionner / Tout désélectionner / Annuler.

**SelectionBar fixe en bas :**
Slide-up dès qu'un média est sélectionné.
Slide-down si sélection vidée.
Affiche "X média(s) sélectionné(s)".
Bouton "💾 Télécharger ma sélection".
Logique selon download_mode :
- open      → génère ZIP directement
- protected → ouvre DownloadCodeModal
- disabled  → message "Téléchargement non disponible"

---

## UploadModal

Deux onglets Photo et Vidéo.
Aucune compression, qualité 100% originale préservée.

**Onglet Photo :**
input type file accept image/* capture environment.
Mobile → appareil photo natif.
Desktop → explorateur fichiers.
Pas de compression, fichier original uploadé tel quel.

**Onglet Vidéo :**
input type file accept video/* capture environment.
Mobile → caméra native.
Desktop → explorateur fichiers.
Pas de compression ni réencodage, qualité originale.

**Validation dans mediaValidation.js avant upload :**

Pour les vidéos :
- Créer élément video temporaire invisible
- URL.createObjectURL pour charger le fichier
- Attendre événement loadedmetadata
- Lire video.duration en secondes
- URL.revokeObjectURL pour libérer la mémoire
- Si durée > VITE_MAX_VIDEO_DURATION refuser avec message clair
- Si taille > VITE_MAX_VIDEO_SIZE_MB refuser avec message clair

Pour les photos :
- Vérifier uniquement le type MIME image

Si validation OK :
- Upload dans bucket wedding-media avec nom UUID unique
- Récupération URL publique Supabase
- Insertion dans table media avec type et duration_seconds
- Apparaît instantanément via Realtime

**UX flow :**
1. Champ pseudo optionnel placeholder "Votre prénom (optionnel)"
2. Bouton choisir fichier
3. Prévisualisation image miniature ou lecteur vidéo HTML5
4. Bouton Envoyer
5. Barre de progression upload
6. Message succès "Votre média est visible par tous 🎉"
7. Gestion erreur message clair et bouton réessayer

---

## DownloadCodeModal

Compare code saisi avec VITE_DOWNLOAD_CODE côté client.
Code correct → lance ZIP.
Code incorrect → animation shake + message erreur.
5 tentatives max → blocage 10 minutes via localStorage timestamp.
Affiche compteur tentatives restantes.

---

## downloadHelpers.js

JSZip côté navigateur sans serveur.
Pour chaque média :
- fetch depuis public_url
- Conversion en blob
- Nom lisible Pseudo_2024-06-15_14h32.jpg ou .mp4
- Doublon de nom → ajouter index (1) (2)
- Ajout au ZIP

Téléchargement via lien a temporaire.

---

## Panel admin route /admin

Formulaire connexion protégé par VITE_ADMIN_PASSWORD.
Session dans sessionStorage.

**Section Médias :**
- Miniatures de tous les médias
- Suppression via client service_role
- Supprime fichier Storage puis ligne en base
- Badge Photo ou Vidéo sur chaque miniature
- Durée en secondes sur les vidéos
- Bouton supprimer avec confirmation
- Compteur X photos Y vidéos Z total

**Section Paramètres téléchargement :**
- Mise à jour de settings dans Supabase
- Realtime → tous les clients reçoivent le changement instantanément
- 3 options radio :
  - 🟢 Mode soirée open téléchargement libre
  - 🔒 Mode post-soirée protected code requis. Affiche "Code actuel : [3 premiers caractères]***"
  - ⛔ Désactivé disabled
- Bouton Sauvegarder avec confirmation verte

**Section Stockage :**
- Appelle /api/disk-usage toutes les 30 secondes
- L'appel est relatif HTTPS vers la Vercel Edge Function
  qui relaie vers l'API disque du VPS en HTTP

Disque additionnel /mnt/media-storage :
- Barre de progression used/total
- Badge vert "● Actif" si reçoit les uploads
- Alerte orange à 80%
- Alerte rouge à 90% "Bascule sur disque principal imminente"

Disque principal /dev/sda1 :
- Barre de progression used/total
- Badge gris "● Standby" ou vert "● Actif fallback"
- Alerte rouge à 85% "Espace critique"

Si /api/disk-usage retourne erreur 503 :
- Afficher "API disque inaccessible — VPS hors ligne ?"

**Section Limites vidéo :**
- Affiche VITE_MAX_VIDEO_DURATION et VITE_MAX_VIDEO_SIZE_MB
- Informatif uniquement

**Section QR Code :**
- qrcode.react pointe vers VITE_APP_URL
- Affiché 300x300px
- Bouton Télécharger PNG via canvas.toDataURL
- Texte "Scannez pour accéder à la galerie"

---

## useMedia.js

Charge tous les médias triés par created_at DESC.
Realtime INSERT → ajoute en tête de liste.
Realtime DELETE → retire de la liste.
Retourne { media, loading, error }.

## useSettings.js

Lit download_mode depuis settings.
Realtime → mise à jour instantanée chez tous les clients.
Retourne { downloadMode, loading }.

---

## Design

**Palette :**
- Fond : #FDFAF6
- Or : #C9A84C
- Or hover : #A8873C
- Texte : #2C2C2C
- Texte secondaire : #8A7F72
- Carte : #FFFFFF ombre douce
- Overlay : rgba(0,0,0,0.85)

**Typographie :**
- Titres : Playfair Display Google Fonts
- Corps : Inter Google Fonts

**Composants :**
- Boutons primaires : fond #C9A84C texte blanc radius 8px
- Boutons secondaires : bordure #C9A84C fond transparent
- Cards : radius 12px ombre hover scale 1.02
- Modals : fond blanc radius 16px backdrop blur
- SelectionBar : fond #2C2C2C texte blanc arrondis en haut

**Animations :**
- SelectionBar slide-up apparition slide-down disparition
- Card sélectionnée bordure or pulsante
- Lightbox fade-in 150ms
- Code incorrect shake
- Upload barre de progression fluide

**Responsive :**
- Mobile first
- Breakpoints 640px et 1024px
- Bouton flottant 56px minimum
- Cases à cocher 24px sur mobile

---

## README.md

Générer un README complet avec toutes les instructions dans l'ordre :

1. Installer Supabase self-hosted sur le VPS
2. Configurer supabase/docker/.env
3. docker compose up -d
4. Monter le disque additionnel /dev/sdb sur /mnt/media-storage
5. sudo ufw allow 8000 et sudo ufw allow 3001
6. Lancer disk-api : cd disk-api && npm install && node server.js &
7. Dashboard Supabase http://IP:8000 → SQL Editor → schema.sql
8. Storage → bucket wedding-media Public
9. Copier .env.example en .env et tout remplir
10. npm install && npm run dev pour tester en local
11. vercel deploy → copier URL dans VITE_APP_URL
12. Ajouter toutes les variables dans Vercel Dashboard
    dont DISK_API_URL=http://141.94.121.159:3001
13. Redéployer vercel deploy
14. Aller sur /admin → QR Code → Télécharger PNG

**Workflow jour J :**
- Avant : download_mode open dans /admin
- Pendant : invités scannent QR uploadent librement
- Fin de soirée : /admin → mode protected
- Envoyer VITE_DOWNLOAD_CODE par SMS aux invités
- Invités sélectionnent leurs médias entrent le code téléchargent
