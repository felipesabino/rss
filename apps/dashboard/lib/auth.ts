import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";

const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "Email + slug",
      credentials: {
        email: { label: "Email", type: "email" },
        slug: { label: "Slug", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const slug = credentials?.slug?.trim();

        if (!email || !slug) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: { email, slug, isActive: true },
        });

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.displayName ?? user.slug,
          slug: user.slug,
        };
      },
    }),
  ],
  callbacks: {
    session({ session, token, user }) {
      const source = user ?? token;
      if (session.user && source) {
        session.user.id = (source as { id?: string }).id ?? session.user.id;
        session.user.slug = (source as { slug?: string }).slug ?? session.user.slug;
        session.user.email = session.user.email ?? (source as { email?: string }).email;
        session.user.name = session.user.name ?? (source as { name?: string }).name;
      }
      return session;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.slug = (user as { slug?: string }).slug;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);

export async function getServerSession() {
  return auth();
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }
  return session;
}
