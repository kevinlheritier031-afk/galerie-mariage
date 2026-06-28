CREATE TABLE media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      pseudo TEXT DEFAULT 'Invite anonyme',
        storage_path TEXT NOT NULL,
          public_url TEXT NOT NULL,
            type TEXT NOT NULL,
              duration_seconds INTEGER,
                created_at TIMESTAMPTZ DEFAULT now()
                );
)