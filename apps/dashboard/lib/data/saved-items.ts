import {
  prisma,
  type Prisma,
  type SavedItem,
  type FeedItem,
  type SourceConfig,
} from "@rss/db";

export type SavedItemWithDetails = SavedItem & {
  feedItem: FeedItem & { sourceConfig: SourceConfig };
};

export async function listSavedItems(userId: string): Promise<SavedItemWithDetails[]> {
  return prisma.savedItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      feedItem: {
        include: {
          sourceConfig: true,
        },
      },
    },
  });
}

export async function createSavedItem(
  userId: string,
  data: Prisma.SavedItemUncheckedCreateInput
): Promise<SavedItem> {
  if (data.userId && data.userId !== userId) {
    throw new Error("Cannot create saved item for a different user");
  }

  return prisma.savedItem.create({
    data: { ...data, userId },
  });
}

export async function deleteSavedItem(userId: string, savedItemId: string): Promise<boolean> {
  const result = await prisma.savedItem.deleteMany({
    where: { id: savedItemId, userId },
  });
  return result.count > 0;
}
