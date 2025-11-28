import { prisma, type Digest } from "@rss/db";

export type DigestPayload = {
  category?: string;
  report?: {
    header?: string;
    mainStories?: Array<{
      sectionTag?: string;
      headline: string;
      sourceName?: string;
      sourceUrl?: string;
      whatHappened?: string;
      shortTermImpact?: string;
      longTermImpact?: string;
      sentiment?: string;
    }>;
    whatElseIsGoingOn?: Array<{
      text: string;
      sourceName?: string;
      sourceUrl?: string;
    }>;
    byTheNumbers?: {
      number: string;
      commentary: string;
    };
    signOff?: string;
  };
  usedItemIds?: number[];
};

export type DigestWithPayload = Digest & { payload: DigestPayload };

export async function listDigests(userId: string): Promise<DigestWithPayload[]> {
  const digests = await prisma.digest.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
  });
  return digests as unknown as DigestWithPayload[];
}

export async function getDigestById(
  userId: string,
  digestId: string
): Promise<DigestWithPayload | null> {
  const digest = await prisma.digest.findFirst({
    where: { id: digestId, userId },
  });
  return digest as unknown as DigestWithPayload | null;
}
