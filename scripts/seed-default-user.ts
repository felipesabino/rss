import { createDb } from './db-client';
import { users } from '../drizzle/schema';

const DEFAULT_USER = {
  id: 'default',
  slug: 'default',
  email: 'default@example.com',
  displayName: 'Default User',
  isActive: true
};

async function main() {
  const { db, pool } = createDb();

  try {
    await db
      .insert(users)
      .values(DEFAULT_USER)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          slug: DEFAULT_USER.slug,
          email: DEFAULT_USER.email,
          displayName: DEFAULT_USER.displayName,
          isActive: DEFAULT_USER.isActive,
          updatedAt: new Date()
        }
      });

    console.log('Default user ensured:', DEFAULT_USER);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Failed to seed default user:', err);
  process.exit(1);
});
