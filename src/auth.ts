import { sign } from "jsonwebtoken";
import { User } from "./entities/User";

export const createTokens = (user: User) => {
  const accessToken = sign(
    { userId: user._id },
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: "15min",
    }
  );

  const refreshToken = sign(
    { userId: user._id, count: user.count },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: "7d",
    }
  );

  return { accessToken, refreshToken };
};
