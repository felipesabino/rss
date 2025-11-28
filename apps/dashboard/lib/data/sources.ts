import { prisma, type Prisma, type SourceConfig } from "@rss/db";

export type CreateSourceInput = Omit<
  Prisma.SourceConfigUncheckedCreateInput,
  "userId" | "id" | "createdAt" | "updatedAt"
>;

export type UpdateSourceInput = Partial<CreateSourceInput>;

export async function listSources(userId: string): Promise<SourceConfig[]> {
  return prisma.sourceConfig.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSourceById(
  userId: string,
  sourceId: string
): Promise<SourceConfig | null> {
  return prisma.sourceConfig.findFirst({
    where: { id: sourceId, userId },
  });
}

export async function createSource(
  userId: string,
  data: CreateSourceInput
): Promise<SourceConfig> {
  return prisma.sourceConfig.create({
    data: { ...data, userId },
  });
}

export async function updateSource(
  userId: string,
  sourceId: string,
  data: UpdateSourceInput
): Promise<SourceConfig> {
  const source = await getSourceById(userId, sourceId);
  if (!source) {
    throw new Error("Source not found for user");
  }

  return prisma.sourceConfig.update({
    where: { id: sourceId },
    data,
  });
}

export async function deleteSource(userId: string, sourceId: string): Promise<boolean> {
  const result = await prisma.sourceConfig.deleteMany({
    where: { id: sourceId, userId },
  });
  return result.count > 0;
}
