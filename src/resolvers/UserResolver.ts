import { Arg, Ctx, Mutation, Query, Resolver } from "type-graphql";

/* Types */
import { MyContext, UserResponse } from "../types";

/* Entities */
import { User, UserUpdateInput } from "../entities/User";

/* Middlewares */
import { ValidateUser } from "../middlewares/userAuth";

@Resolver()
export class UserResolver {
  /* Route to get user information from a cookie */
  @ValidateUser()
  @Query(() => UserResponse, { nullable: true })
  async me(@Ctx() { em, request }: MyContext): Promise<UserResponse | null> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = request as any;

    // check to see if the header was set from the middleware
    if (!req.userId) {
      return null;
    }

    // find the user
    const user = await em.findOne(
      User,
      { _id: req.userId },
      { populate: ["bibleHistory"] }
    );

    // throw error if user is not found
    if (!user) {
      const error: UserResponse = {
        errors: [
          {
            message: `No user found, try to log in.`,
          },
        ],
      };
      return error;
    }

    return { user };
  }

  @ValidateUser()
  @Mutation(() => UserResponse)
  async updateUser(
    @Arg("options", () => UserUpdateInput) options: UserUpdateInput,
    @Ctx() { em, request }: MyContext
  ): Promise<UserResponse | null> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = request as any;

    // check to see if the header was set from the middleware
    if (!req.userId) {
      const error: UserResponse = {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };

      return error;
    }

    // find the user
    const user = await em.findOne(User, { _id: req.userId });

    // throw error if user is not found
    if (!user) {
      const error: UserResponse = {
        errors: [
          {
            message: `No user found, try to log in.`,
          },
        ],
      };
      return error;
    }

    try {
      em.assign(user, options);
      em.persistAndFlush(user);
    } catch (e) {
      console.log(e);
    }

    return { user };
  }
}
