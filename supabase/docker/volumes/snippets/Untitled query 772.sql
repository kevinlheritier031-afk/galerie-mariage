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

                CREATE POLICY "Public read" ON media
                  FOR SELECT USING (true);

                  CREATE POLICY "Public insert" ON media
                    FOR INSERT WITH CHECK (true);

                    CREATE POLICY "Service role delete" ON media
                      FOR DELETE USING (auth.role() = 'service_role');

                      CREATE TABLE settings (
                        key TEXT PRIMARY KEY,
                          value TEXT NOT NULL
                          );

                          INSERT INTO settings (key, value) VALUES ('download_mode', 'open');

                          CREATE POLICY "Public read settings" ON settings
                            FOR SELECT USING (true);

                            CREATE POLICY "Service role update settings" ON settings
                              FOR UPDATE USING (auth.role() = 'service_role');
)