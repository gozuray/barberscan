import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";
import { DEV_LOCAL_CLERK_ID, DEV_LOCAL_EMAIL, DEV_NO_AUTH } from "@/lib/dev-mode";

/**
 * When `LOCAL_DEV_NO_AUTH=true` we skip Clerk entirely and return the
 * single local dev user. The row is created on demand with a STUDIO
 * subscription so quotas never block testing.
 */
async function getLocalDevUser(): Promise<User> {
  const existing = await db.user.findUnique({ where: { clerkId: DEV_LOCAL_CLERK_ID } });
  if (existing) return existing;

  return db.user.create({
    data: {
      clerkId: DEV_LOCAL_CLERK_ID,
      email: DEV_LOCAL_EMAIL,
      name: "Local Dev",
      subscription: { create: { tier: "STUDIO", status: "ACTIVE" } },
    },
  });
}

/**
 * Resolves the currently authenticated user and mirrors Clerk → DB lazily.
 * If no DB row exists yet (first sign-in before webhook completes), we create it.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (DEV_NO_AUTH) return getLocalDevUser();

  const { userId } = await auth();
  if (!userId) return null;

  let user = await db.user.findUnique({ where: { clerkId: userId } });
  if (user) return user;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) return null;

  user = await db.user.create({
    data: {
      clerkId: userId,
      email: primaryEmail,
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
      imageUrl: clerkUser.imageUrl,
    },
  });

  await db.subscription.create({
    data: { userId: user.id, tier: "FREE", status: "TRIALING" },
  });

  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}
