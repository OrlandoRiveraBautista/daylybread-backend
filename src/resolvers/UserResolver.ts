import { Arg, Ctx, Mutation, Query, Resolver, ObjectType, Field } from "type-graphql";

/* Types */
import { MyContext, UserResponse } from "../types";

/* Entities */
import { User, UserUpdateInput } from "../entities/User";
import { FieldError } from "../entities/Errors/FieldError";

/* Middlewares */
import { ValidateUser } from "../middlewares/userAuth";

// Admin user ID that has access to search users
const SUDO_ADMIN_USER_ID = "65239e9380cfeb07c8fb0145";

/**
 * Response type for user search operations
 */
@ObjectType()
class UsersSearchResponse {
  @Field(() => [User], { nullable: true })
  results?: User[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
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

  /**
   * Search users by email, first name, or last name.
   * Only accessible by sudo admin users.
   *
   * @param searchTerm - The search term to match against email, firstName, or lastName
   * @param limit - Maximum number of results to return (default: 20)
   * @param em - Database entity manager from GraphQL context
   * @param request - HTTP request object containing user authentication data
   * @returns Promise<UsersSearchResponse> - The matching users or error details
   */
  @ValidateUser()
  @Query(() => UsersSearchResponse)
  async searchUsers(
    @Arg("searchTerm", () => String) searchTerm: string,
    @Arg("limit", () => Number, { nullable: true }) limit: number = 20,
    @Ctx() { em, request }: MyContext
  ): Promise<UsersSearchResponse> {
    const req = request as any;

    // Check if user is authenticated
    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    // Check if user is sudo admin
    if (req.userId.toString() !== SUDO_ADMIN_USER_ID) {
      return {
        errors: [
          {
            field: "Authorization",
            message: "You do not have permission to search users.",
          },
        ],
      };
    }

    // Search for users matching the search term
    try {
      const regex = new RegExp(searchTerm, "i");
      const users = await em.find(
        User,
        {
          $or: [
            { email: regex },
            { firstName: regex },
            { lastName: regex },
          ],
        } as any,
        { limit }
      );

      return { results: users };
    } catch (error) {
      console.error("Error searching users:", error);
      return {
        errors: [
          {
            field: "Search",
            message: "Failed to search users.",
          },
        ],
      };
    }
  }

  /**
   * Get a user by their ID.
   * Only accessible by sudo admin users.
   *
   * @param userId - The user ID to look up
   * @param em - Database entity manager from GraphQL context
   * @param request - HTTP request object containing user authentication data
   * @returns Promise<UserResponse> - The user or error details
   */
  @ValidateUser()
  @Query(() => UserResponse)
  async getUserById(
    @Arg("userId", () => String) userId: string,
    @Ctx() { em, request }: MyContext
  ): Promise<UserResponse> {
    const req = request as any;

    // Check if user is authenticated
    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    // Check if user is sudo admin
    if (req.userId.toString() !== SUDO_ADMIN_USER_ID) {
      return {
        errors: [
          {
            field: "Authorization",
            message: "You do not have permission to view other users.",
          },
        ],
      };
    }

    try {
      const { ObjectId } = await import("@mikro-orm/mongodb");
      const user = await em.findOne(User, { _id: new ObjectId(userId) });

      if (!user) {
        return {
          errors: [
            {
              field: "User",
              message: "User not found.",
            },
          ],
        };
      }

      return { user };
    } catch (error) {
      console.error("Error getting user:", error);
      return {
        errors: [
          {
            field: "User",
            message: "Failed to get user.",
          },
        ],
      };
    }
  }
}
