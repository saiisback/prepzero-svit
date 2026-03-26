import "server-only";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { getSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const createCaller = createCallerFactory(appRouter);

export async function getServerTrpc() {
  const session = await getSession();

  return createCaller({
    prisma,
    session,
    user: session?.user ?? null,
  });
}
