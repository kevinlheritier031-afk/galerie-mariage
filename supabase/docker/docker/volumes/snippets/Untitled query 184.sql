CREATE TABLE media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      pseudo TEXT DEFAULT 'Invite anonyme',
        storage_path TEXT NOT NULL,
          public_url TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
              duration_seconds INTEGER,
                created_at TIMESTAMPTZ DEFAULT now()
                );

                ALTER TABLE media ENABLE ROW LEVEL SECURITY;

                CREATE TABLE settings (
                  key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                    );

                    INSERT INTO settings (key, value) VALUES ('download_mode', 'open');
)