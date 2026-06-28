-- Schéma de base de données pour Galerie Mariage
-- A exécuter dans SQL Editor du Dashboard Supabase (http://IP:8000)

-- ─────────────────────────────────────────────────────────────────────────────
-- Table principale des médias photos et vidéos
-- Chaque ligne est un fichier uploadé par un invité
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Table des paramètres globaux
-- Permet de changer le comportement sans redéployer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Téléchargement libre par défaut pendant la soirée
INSERT INTO settings (key, value) VALUES ('download_mode', 'open');
-- open      = téléchargement libre sans code pendant la soirée
-- protected = code secret requis après la soirée
-- disabled  = téléchargement complètement désactivé

CREATE POLICY "Public read settings" ON settings
  FOR SELECT USING (true);

CREATE POLICY "Service role update settings" ON settings
  FOR UPDATE USING (auth.role() = 'service_role');
