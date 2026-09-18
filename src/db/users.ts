import { db } from './index.ts';
import { users } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (existing.length > 0) {
      return existing[0];
    }

    const username = email ? email.split('@')[0] : `user_${uid.slice(0, 6)}`;
    const result = await db.insert(users)
      .values({
        id: uid,
        uid,
        email,
        name: name || username,
        username,
        role: 'OPERATOR',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user lookup/create failed:', error);
    throw new Error('Failed to get or create user profile', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed for users:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
