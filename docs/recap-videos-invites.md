# Récap : solutions pour l'import de vidéos par les invités

## Contexte du problème

Les vidéos de mariage sont volumineuses (facilement 500 MB–2 GB/vidéo), les invités seront nombreux à uploader en même temps, et le VPS stocke tout sur disque. Sans changement, le disque sature et le serveur rame.

---

## Toutes les solutions possibles

### 1. Cloudflare R2 + presigned URLs *(recommandé)*

**Comment ça marche :** L'API génère une URL signée temporaire, le téléphone de l'invité uploade **directement** sur R2 (le VPS ne touche jamais le fichier vidéo). Ensuite le VPS enregistre juste les métadonnées en base.

**Avantages :**
- VPS complètement bypassé pour l'upload
- Pas de limite de taille/durée
- **0€ de frais de sortie** (Cloudflare ne facture pas la bande passante, contrairement à AWS S3)
- Qualité originale préservée
- ~50 vidéos de 1 Go = **~0,75€/mois** de stockage
- CDN Cloudflare intégré pour la lecture

**Inconvénients :**
- Nécessite un compte Cloudflare (gratuit) + un peu de config
- Quelques jours de dev pour intégrer

---

### 2. Backblaze B2 + Cloudflare proxy *(option la moins chère)*

Même principe que R2, mais encore moins cher ($0,006/Go). Couplé à Cloudflare en proxy, l'egress devient gratuit.

**Avantages :** Pratiquement gratuit pour un mariage (10 Go offerts, puis quasi rien)
**Inconvénients :** Légèrement plus complexe à configurer que R2, moins "clé en main"

---

### 3. Supabase Storage *(déjà dans le projet)*

Supabase Storage supporte les gros fichiers. Sur le plan Pro, 100 Go inclus.

**Avantages :** Zéro infra supplémentaire, déjà intégré dans le projet
**Inconvénients :** Si vous êtes sur le plan free, limite à 1 Go. Sur Pro c'est viable mais le coût peut monter si beaucoup de vidéos. À vérifier selon votre plan actuel.

---

### 4. Compression côté client (ffmpeg.wasm) + stockage actuel

Avant upload, on compresse la vidéo **dans le navigateur** de l'invité (WebAssembly FFmpeg). Une vidéo de 1 Go peut descendre à 150-200 Mo avec une qualité encore très bonne.

**Avantages :** Pas besoin de changer l'infra, réduit drastiquement le stockage
**Inconvénients :** Très lent sur mobile (2-5 min de traitement), peut planter sur les vieux téléphones, expérience dégradée

---

### 5. Cloudflare Stream *(meilleure qualité, plus cher)*

Plateforme vidéo dédiée. Upload direct, transcodage automatique, streaming adaptatif (comme YouTube).

**Avantages :** Qualité professionnelle, pas de gestion technique
**Inconvénients :** $1/1000 minutes stockées + $1/1000 minutes visionnées. Pour 100 vidéos de 5 min = $0,50 stockage + frais de lecture. Raisonnable mais plus cher que R2.

---

### 6. YouTube/Vimeo unlisted

Uploader les vidéos sur YouTube en non-listé et les embarquer dans la galerie.

**Avantages :** Gratuit, illimité, qualité parfaite
**Inconvénients :** Complexe pour les invités (besoin d'un compte), YouTube peut supprimer les vidéos si musique copyrightée (DJ, soirée), pas intégré proprement

---

### 7. WeTransfer / Google Drive (collecte manuelle)

Fournir un lien de dépôt WeTransfer ou Google Drive aux invités, puis intégrer manuellement dans la galerie.

**Avantages :** Zéro dev
**Inconvénients :** Pas intégré à la galerie, vous devez tout traiter manuellement

---

## Résumé comparatif

| Solution | VPS protégé | Qualité | Limite durée | Coût | Complexité dev |
|---|---|---|---|---|---|
| **R2 + presigned** | Oui | Originale | Aucune | ~0€ | Modérée |
| Backblaze B2 + CF | Oui | Originale | Aucune | ~0€ | Modérée |
| Supabase Storage | Oui | Originale | Aucune | Selon plan | Faible |
| ffmpeg.wasm | Non | Bonne | Aucune | 0€ | Élevée |
| Cloudflare Stream | Oui | Parfaite | Aucune | ~1-5€ | Faible |
| YouTube | Oui | Parfaite | Aucune | 0€ | Élevée |

---

## Recommandation

**Cloudflare R2 avec presigned URLs** est la meilleure combinaison : VPS totalement protégé, qualité originale, aucune limite de durée, coût quasi nul pour un mariage, et Cloudflare gère déjà le domaine dans beaucoup de setups Vercel.

**Si vous voulez zéro nouvelle infra**, vérifier d'abord votre plan Supabase — si vous êtes sur Pro (100 Go), c'est suffisant et c'est déjà branché.
