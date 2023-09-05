import { verify } from "jsonwebtoken";
import { createTokens } from "../auth";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { createMethodDecorator } from "type-graphql";
import { addTime } from "../utility";

/**
 * Function validates users by looking at the access token or refresh token
 */
export const ValidateUser = () => {
  return createMethodDecorator(
    async ({ context }: { context: MyContext }, next) => {
      const request = context.request as any; // set request as any use freely

      const cookies = request.cookies; // get the cookie from request
      const accessToken = cookies["access-token"]; // get access token
      const refreshToken = cookies["refresh-token"]; // get refresh token

      //check for tokens
      if (!refreshToken && !accessToken) return next();

      // try to deconde the access token
      try {
        const decodedAccessToken = verify(
          accessToken,
          process.env.ACCESS_TOKEN_SECRET!
        ) as any;
        // get user id
        const userId = decodedAccessToken.userId;
        // set user id to the request
        request.userId = userId;
        return next();
      } catch {}

      if (!refreshToken) return next();

      let decodedRefreshToken;
      // try to decode the refresh token
      try {
        decodedRefreshToken = verify(
          refreshToken,
          process.env.REFRESH_TOKEN_SECRET!
        ) as any;
      } catch {
        return next();
      }

      const user = await context.em.findOne(User, {
        _id: decodedRefreshToken.userId,
      });

      // check if token has been invalidated
      if (!user || user.count !== decodedRefreshToken.count) return next();

      const tokens = createTokens(user);

      context.reply.cookie("refresh-token", tokens.refreshToken, {
        expires: addTime({ date: new Date(), typeOfTime: "days", time: 7 }), //expires in a week (7days)
      });

      context.reply.cookie("access-token", tokens.accessToken, {
        expires: addTime({ date: new Date(), typeOfTime: "minutes", time: 15 }), //expires in 15mins
      });

      return next();
    }
  );
};
