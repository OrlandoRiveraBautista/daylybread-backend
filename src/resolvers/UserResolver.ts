import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
} from "type-graphql";

/* Types */
import { MyContext, UserResponse } from "../types";

/* Entities */
import { User } from "../entities/User";

/* Middlewares */
import { ValidateUser } from "../middlewares/userAuth";

/**
 * !Since this type is being used in an update route
 * !this potentially has to be centralized and generalized
 */
@InputType()
class RegisterUpdateUser {
  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field({ nullable: true })
  churchName?: string;

  @Field()
  dob: Date;
}

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

    return { user };
  }

  @ValidateUser()
  @Mutation(() => UserResponse)
  async updateUser(
    @Arg("options", () => RegisterUpdateUser) options: RegisterUpdateUser,
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
