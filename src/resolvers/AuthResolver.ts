import { Arg, Ctx, Mutation, Query, Resolver } from "type-graphql";
import bcrypt from "bcrypt";

/* Types */
import { MyContext, UserResponse, UsernamePasswordInput } from "../types";

/* Entities */
import { User } from "../entities/User";

/* Utilities */
import { createTokens } from "../auth";
import { addTime } from "../utility";

const validateEmail = (email: string) => {
  return email.match(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  );
};

@Resolver()
export class AuthResolver {
  @Query(() => UserResponse)
  async login(
    @Arg("options", () => UsernamePasswordInput) options: UsernamePasswordInput,
    @Ctx() { em, reply }: MyContext
  ): Promise<UserResponse> {
    // check if the user provided a valid email
    if (!validateEmail(options.email)) {
      return {
        errors: [
          {
            field: "Email",
            message: "Invalid email, please try again",
          },
        ],
      };
    }

    // try to find the user with email
    const user = await em.findOne(User, { email: options.email });

    // throw error if user is not found
    if (!user) {
      const error: UserResponse = {
        errors: [
          {
            field: "Email",
            message: `No user with email ${options.email} found`,
          },
        ],
      };
      return error;
    }

    // check email hash
    const validPass = await bcrypt.compare(options.password, user.password);

    // throw error if password is not correct
    if (!validPass) {
      const error: UserResponse = {
        errors: [
          {
            field: "Password",
            message: "Incorrect email or pasword. Please try again.",
          },
        ],
      };
      return error;
    }

    const { refreshToken, accessToken } = createTokens(user);

    reply.cookie("refresh-token", refreshToken, {
      expires: addTime({ date: new Date(), typeOfTime: "days", time: 7 }), //expires in a week (7days)
    });

    reply.cookie("access-token", accessToken, {
      expires: addTime({ date: new Date(), typeOfTime: "minutes", time: 15 }), //expires in 15mins
    });

    return { user };
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options", () => UsernamePasswordInput) options: UsernamePasswordInput,
    @Ctx() { em, reply }: MyContext
  ): Promise<UserResponse> {
    // check if the email is too small
    if (options.email.length <= 2) {
      const error: UserResponse = {
        errors: [
          {
            field: "Email",
            message: "Email is too short",
          },
        ],
      };

      return error;
    }

    // check if the user provided a valid email
    if (!validateEmail(options.email)) {
      return {
        errors: [
          {
            field: "Email",
            message: "Invalid email, please try again",
          },
        ],
      };
    }

    // check if password is long enough
    if (options.password.length <= 7) {
      return {
        errors: [
          {
            field: "Password",
            message: "Password needs to be at least 8 characters long",
          },
        ],
      };
    }

    // hash password
    const hashedPass = await bcrypt.hash(options.password, 10);

    // create new user object
    const newUser = em.create(User, {
      email: options.email,
      password: hashedPass,
      count: 1,
    });

    try {
      // try to save user object to db
      await em.persistAndFlush(newUser);
    } catch (error) {
      // catch any errors
      // check if the field with the error is an email
      // this most likely means that the email has already been used
      if (Object.keys(error.keyValue)[0] === "email") {
        const err: UserResponse = {
          errors: [
            {
              field: "Email",
              message: `Email ${
                Object.values(error.keyValue)[0]
              } is already in use`,
            },
          ],
        };

        return err;
      }

      throw error;
    }

    const { refreshToken, accessToken } = createTokens(newUser);

    reply.cookie("refresh-token", refreshToken, {
      expires: addTime({ date: new Date(), typeOfTime: "days", time: 7 }), //expires in a week (7days)
    });

    reply.cookie("access-token", accessToken, {
      expires: addTime({ date: new Date(), typeOfTime: "minutes", time: 15 }), //expires in 15mins
    });

    return { user: newUser };
  }

  /**
   * This route can be used to invalidate all tokens in any browser
   * Good use case is when a user has reset their password
   */
  @Mutation(() => Boolean)
  async invalidateTokens(@Ctx() { em, request }: MyContext): Promise<boolean> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = request as any;

    // check to see if the header was set from the middleware
    if (!req.userId) {
      return false;
    }

    const user = await em.findOne(User, { _id: req.userId });

    if (!user) {
      return false;
    }

    user.count += 1;
    await em.persistAndFlush(user);

    return true;
  }

  // Get all of the test data
  // @Query(() => String)
  // async signup(@Ctx() { em }: MyContext) {
  //   // const s = await em.find(Test, {});
  //   // return s;
  // }
}
