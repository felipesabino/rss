import { prisma, type User } from "@rss/db";

export async function getUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id: userId } });
}
