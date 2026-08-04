import { verify } from "jsonwebtoken";
import { createTokens } from "../auth";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { createMethodDecorator } from "type-graphql";
import { addTime } from "../utility";

/**
 * Hydrate `request.userId` from access/refresh cookies when present.
 * Does not reject unauthenticated requests.
 */
async function hydrateUser(context: MyContext): Promise<void> {
  const request = context.request as any;
  const cookies = request.cookies;
  const accessToken = cookies["access-token"];
  const refreshToken = cookies["refresh-token"];

  if (!refreshToken && !accessToken) return;

  try {
    const decodedAccessToken = verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET!
    ) as any;
    request.userId = decodedAccessToken.userId;
    return;
  } catch {
    // fall through to refresh token
  }

  if (!refreshToken) return;

  let decodedRefreshToken: any;
  try {
    decodedRefreshToken = verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET!
    ) as any;
  } catch {
    return;
  }

  const user = await context.em.findOne(User, {
    _id: decodedRefreshToken.userId,
  });

  if (!user || user.count !== decodedRefreshToken.count) return;

  const tokens = createTokens(user);

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

  request.userId = user._id;
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
