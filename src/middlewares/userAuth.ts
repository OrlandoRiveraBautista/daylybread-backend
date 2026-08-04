import { verify } from "jsonwebtoken";
import { createTokens } from "../auth";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { createMethodDecorator } from "type-graphql";
import { addTime } from "../utility";
import { EntityManager } from "@mikro-orm/mongodb";

export type AuthCookieBag = {
  "access-token"?: string;
  "refresh-token"?: string;
};

export function parseCookieHeader(cookieHeader?: string): AuthCookieBag {
  if (!cookieHeader) return {};
  const out: AuthCookieBag = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (key === "access-token" || key === "refresh-token") {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Resolve userId from access/refresh tokens without Fastify request/reply.
 * Optionally rotates refresh tokens via onTokensRefresh.
 */
export async function resolveUserIdFromTokens(options: {
  accessToken?: string;
  refreshToken?: string;
  em: EntityManager;
  onTokensRefresh?: (tokens: {
    accessToken: string;
    refreshToken: string;
  }) => void;
}): Promise<string | undefined> {
  const { accessToken, refreshToken, em, onTokensRefresh } = options;

  if (!refreshToken && !accessToken) return undefined;

  if (accessToken) {
    try {
      const decodedAccessToken = verify(
        accessToken,
        process.env.ACCESS_TOKEN_SECRET!
      ) as { userId?: string };
      if (decodedAccessToken.userId) {
        return String(decodedAccessToken.userId);
      }
    } catch {
      // fall through to refresh token
    }
  }

  if (!refreshToken) return undefined;

  let decodedRefreshToken: { userId?: string; count?: number };
  try {
    decodedRefreshToken = verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as { userId?: string; count?: number };
  } catch {
    return undefined;
  }

  if (!decodedRefreshToken.userId) return undefined;

  const user = await em.findOne(User, {
    _id: decodedRefreshToken.userId as any,
  });

  if (!user || user.count !== decodedRefreshToken.count) return undefined;

  if (onTokensRefresh) {
    const tokens = createTokens(user);
    onTokensRefresh(tokens);
  }

  return String(user._id);
}

/**
 * Hydrate `request.userId` from access/refresh cookies when present.
 * Does not reject unauthenticated requests.
 */
async function hydrateUser(context: MyContext): Promise<void> {
  const request = context.request as any;
  const cookies = (request.cookies || {}) as AuthCookieBag;
  const accessToken = cookies["access-token"];
  const refreshToken = cookies["refresh-token"];

  const userId = await resolveUserIdFromTokens({
    accessToken,
    refreshToken,
    em: context.em,
    onTokensRefresh: (tokens) => {
      context.reply.cookie("refresh-token", tokens.refreshToken, {
        expires: addTime({ date: new Date(), typeOfTime: "days", time: 7 }),
        sameSite: "none",
        secure: true,
      });

      context.reply.cookie("access-token", tokens.accessToken, {
        expires: addTime({ date: new Date(), typeOfTime: "minutes", time: 15 }),
        sameSite: "none",
        secure: true,
      });
    },
  });

  if (userId) {
    request.userId = userId;
  }
}

/** Read authenticated user id from GraphQL context (HTTP or WS). */
export function getContextUserId(context: MyContext): string | undefined {
  const fromCtx = (context as MyContext & { userId?: string }).userId;
  if (fromCtx) return String(fromCtx);
  const request = context.request as { userId?: string } | undefined;
  if (request?.userId) return String(request.userId);
  return undefined;
}

/**
 * Soft auth: attach `request.userId` when cookies are valid.
 * Continues even when the user is not authenticated.
 */
export const ValidateUser = () => {
  return createMethodDecorator(
    async ({ context }: { context: MyContext }, next) => {
      await hydrateUser(context);
      return next();
    }
  );
};

/**
 * Hard auth: hydrate session, then reject if unauthenticated.
 * Use on resolvers that require a logged-in user.
 */
export const RequireAuth = () => {
  return createMethodDecorator(
    async ({ context }: { context: MyContext }, next) => {
      await hydrateUser(context);

      const request = context.request as any;
      if (!request.userId) {
        throw new Error("Authentication required. Please login first.");
      }

      return next();
    }
  );
};
