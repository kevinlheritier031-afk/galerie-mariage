# Galerie Mariage 💍

Application web de galerie photo/vidéo pour mariage.
Les invités scannent un QR code, uploadent leurs photos et vidéos,
et tout le monde les voit instantanément en temps réel.

**Stack :** React + Vite · Tailwind CSS · Supabase self-hosted · JSZip · qrcode.react · Vercel Edge Functions

---

## Installation complète pas à pas

### 1. Supabase self-hosted sur le VPS

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Éditez .env avec les secrets générés (voir section Supabase .env plus bas)
```

### 2. Configurer supabase/docker/.env

Les valeurs minimales à changer :

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL (générer avec `openssl rand -base64 32`) |
| `JWT_SECRET` | Secret JWT HS256 (minimum 32 caractères) |
| `ANON_KEY` | JWT signé avec JWT_SECRET, payload `{"role":"anon","iss":"supabase"}` |
| `SERVICE_ROLE_KEY` | JWT signé avec JWT_SECRET, payload `{"role":"service_role","iss":"supabase"}` |
| `SITE_URL` | URL publique de l'application (ex: `http://141.94.121.159:8000`) |
| `STORAGE_BACKEND` | `file` pour stockage local |
| `FILE_STORAGE_BACKEND_PATH` | `/mnt/media-storage` |

### 3. Lancer Supabase

```bash
cd supabase/docker
docker compose up -d
```

Vérification : `docker compose ps` — tous les services doivent être `healthy`.

### 4. Monter le disque additionnel

```bash
# Identifier le disque additionnel
lsblk

# Formater (seulement la première fois !)
sudo mkfs.ext4 /dev/sdb

# Monter
sudo mkdir -p /mnt/media-storage
sudo mount /dev/sdb /mnt/media-storage

# Montage automatique au démarrage
echo '/dev/sdb /mnt/media-storage ext4 defaults 0 2' | sudo tee -a /etc/fstab

# Donner les droits à Supabase Storage (conteneur Docker)
sudo chmod 777 /mnt/media-storage
```

### 5. Ouvrir les ports

```bash
sudo ufw allow 8000   # Supabase API Gateway (Kong)
sudo ufw allow 3001   # API disque Express
sudo ufw reload
```

### 6. Lancer l'API disque

```bash
cd ~/galerie-mariage/disk-api
npm install
# En arrière-plan avec nohup pour survivre à la déconnexion SSH
nohup node server.js > /tmp/disk-api.log 2>&1 &
echo "PID: $!"
```

Vérification : `curl http://localhost:3001/api/disk-usage`

### 7. Créer le schéma SQL

1. Ouvrir le Dashboard Supabase : `http://141.94.121.159:8000`
2. Se connecter (identifiants dans `supabase/docker/.env` : `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`)
3. Aller dans **SQL Editor**
4. Coller et exécuter le contenu de `supabase/schema.sql`

### 8. Créer le bucket Storage

1. Dans le Dashboard Supabase → **Storage**
2. Créer un bucket nommé `wedding-media`
3. Cocher **Public bucket** (pour que les URLs publiques soient accessibles sans auth)

### 9. Configurer l'application

```bash
cd ~/galerie-mariage
cp .env.example .env
```

Remplir `.env` :

```env
VITE_SUPABASE_URL=http://141.94.121.159:8000
VITE_SUPABASE_ANON_KEY=<votre ANON_KEY de supabase/docker/.env>
VITE_SUPABASE_SERVICE_KEY=<votre SERVICE_ROLE_KEY de supabase/docker/.env>
VITE_ADMIN_PASSWORD=<mot de passe fort pour /admin>
VITE_DOWNLOAD_CODE=<code secret partagé aux invités post-soirée>
VITE_APP_URL=https://votre-galerie.vercel.app
VITE_MAX_VIDEO_DURATION=60
VITE_MAX_VIDEO_SIZE_MB=100
DISK_API_URL=http://141.94.121.159:3001
```

### 10. Tester en local

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:5173` et tester un upload.

### 11. Déployer sur Vercel

```bash
# Installer Vercel CLI si nécessaire
npm install -g vercel

# Premier déploiement
vercel deploy

# Copier l'URL affichée (ex: https://galerie-mariage-xxx.vercel.app)
# La mettre dans VITE_APP_URL dans .env et dans Vercel Dashboard
```

### 12. Ajouter les variables dans Vercel Dashboard

Dans **Vercel Dashboard → Projet → Settings → Environment Variables**, ajouter :

| Variable | Valeur | Environnement |
|---|---|---|
| `VITE_SUPABASE_URL` | `http://141.94.121.159:8000` | Production |
| `VITE_SUPABASE_ANON_KEY` | `votre anon_key` | Production |
| `VITE_SUPABASE_SERVICE_KEY` | `votre service_role_key` | Production |
| `VITE_ADMIN_PASSWORD` | `votre mot de passe` | Production |
| `VITE_DOWNLOAD_CODE` | `votre code` | Production |
| `VITE_APP_URL` | `https://votre-galerie.vercel.app` | Production |
| `VITE_MAX_VIDEO_DURATION` | `60` | Production |
| `VITE_MAX_VIDEO_SIZE_MB` | `100` | Production |
| `DISK_API_URL` | `http://141.94.121.159:3001` | Production |

### 13. Redéployer

```bash
vercel deploy --prod
```

### 14. Récupérer le QR Code

1. Aller sur `https://votre-galerie.vercel.app/admin`
2. Se connecter avec `VITE_ADMIN_PASSWORD`
3. Section **QR Code** → bouton **Télécharger PNG**
4. Imprimer et placer sur les tables du mariage

---

## Workflow jour J

### Avant la soirée
- Vérifier que Supabase tourne : `docker compose ps` → tous `healthy`
- Vérifier l'API disque : `curl http://localhost:3001/api/disk-usage`
- Dans `/admin` → Paramètres → sélectionner **🟢 Mode soirée (open)**
- Sauvegarder

### Pendant la soirée
- Les invités scannent le QR code
- Ils uploadent photos et vidéos directement depuis leur téléphone
- Tout le monde voit les uploads en temps réel dans la galerie

### Fin de soirée
- Dans `/admin` → Paramètres → sélectionner **🔒 Mode post-soirée (protected)**
- Sauvegarder
- Envoyer `VITE_DOWNLOAD_CODE` par SMS aux invités
- Les invités sélectionnent leurs médias préférés, entrent le code et téléchargent un ZIP

---

## Structure du projet

```
galerie-mariage/
├── src/
│   ├── components/
│   │   ├── Gallery.jsx          # Galerie publique (route /)
│   │   ├── MediaCard.jsx        # Carte individuelle photo/vidéo
│   │   ├── Lightbox.jsx         # Visionneuse plein écran
│   │   ├── UploadModal.jsx      # Modal d'upload
│   │   ├── SelectionBar.jsx     # Barre de sélection fixe en bas
│   │   ├── DownloadCodeModal.jsx # Modal code secret
│   │   ├── AdminPanel.jsx       # Panel admin (route /admin)
│   │   └── VideoPlayer.jsx      # Lecteur vidéo HTML5
│   ├── lib/
│   │   ├── supabase.js          # Clients Supabase (anon + service role)
│   │   ├── downloadHelpers.js   # Génération ZIP avec JSZip
│   │   └── mediaValidation.js   # Validation avant upload
│   ├── hooks/
│   │   ├── useMedia.js          # Médias + Realtime
│   │   └── useSettings.js       # Paramètres + Realtime
│   ├── App.jsx                  # Routes React Router
│   └── main.jsx                 # Point d'entrée
├── api/
│   └── disk-usage.js            # Vercel Edge Function (relais HTTP→HTTPS)
├── disk-api/
│   ├── server.js                # API Express surveillance disque
│   └── package.json
├── supabase/
│   └── schema.sql               # Schéma SQL à exécuter dans Supabase
├── .env.example                 # Template des variables d'environnement
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## Commandes utiles

```bash
# Logs Supabase
cd ~/galerie-mariage/supabase/docker && docker compose logs -f

# Redémarrer Supabase
docker compose restart

# Vérifier l'API disque
curl http://localhost:3001/api/disk-usage | jq

# Build de production
npm run build

# Preview du build
npm run preview
```
