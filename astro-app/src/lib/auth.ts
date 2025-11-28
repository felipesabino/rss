export type SessionUser = {
  id?: string;
  slug?: string;
  email?: string;
  name?: string;
};

export type Session = {
  user?: SessionUser;
};

const demoUser: SessionUser = {
  id: process.env.DEMO_USER_ID ?? "default",
  slug: process.env.DEMO_USER_SLUG ?? "default",
  email: process.env.DEMO_USER_EMAIL,
  name: process.env.DEMO_USER_NAME ?? "Demo User",
};

export async function getServerSession(): Promise<Session | null> {
  // Placeholder session implementation; replace with real auth wiring during API migration.
  return { user: demoUser };
}

export async function requireUser(): Promise<Session> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/api/auth/signin" },
    });
  }
  return session;
}
