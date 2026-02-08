import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  InputType,
  Field,
  ObjectType,
} from "type-graphql";
import { HomeScreen } from "../../entities/HomeScreen";
import { TileConfigInput } from "../../entities/TileConfig";
import { MyContext } from "../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";

/**
 * Input type for creating or updating HomeScreen
 */
@InputType()
class HomeScreenInput {
  @Field(() => String)
  name!: string;

  @Field(() => [TileConfigInput], { nullable: true })
  tiles?: TileConfigInput[];

  @Field(() => String, { nullable: true })
  wallpaper?: string;
}

/**
 * Response type for HomeScreen operations
 */
@ObjectType()
class HomeScreenResponse {
  @Field(() => HomeScreen, { nullable: true })
  results?: HomeScreen;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

/**
 * Response type for multiple HomeScreens
 */
@ObjectType()
class HomeScreensResponse {
  @Field(() => [HomeScreen], { nullable: true })
  results?: HomeScreen[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

/**
 * GraphQL resolver for HomeScreen operations.
 * Handles creating, reading, updating, and deleting home screens
 * with user authentication and view tracking.
 */
@Resolver()
export class HomeScreenResolver {
  /**
   * Retrieves a single HomeScreen by ID.
   */
  @Query(() => HomeScreenResponse)
  async getHomeScreen(@Arg("id") id: string, @Ctx() { em }: MyContext) {
    const homeScreen = await em.findOne(HomeScreen, { _id: new ObjectId(id) });
    if (!homeScreen) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Home screen not found",
          },
        ],
      };
    }

    return { results: homeScreen };
  }

  /**
   * Retrieves a HomeScreen by shareable link slug.
   */
  @Query(() => HomeScreenResponse)
  async getHomeScreenByLink(
    @Arg("shareableLink") shareableLink: string,
    @Ctx() { em }: MyContext,
  ) {
    const homeScreen = await em.findOne(HomeScreen, { shareableLink });
    if (!homeScreen) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Home screen not found",
          },
        ],
      };
    }

    return { results: homeScreen };
  }

  /**
   * Retrieves all HomeScreens for the authenticated user.
   */
  @ValidateUser()
  @Query(() => HomeScreensResponse)
  async getHomeScreensByOwner(
    @Ctx() { em, request }: MyContext,
  ): Promise<HomeScreensResponse> {
    const req = request as any;

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

    const homeScreens = await em.find(
      HomeScreen,
      { owner: req.userId },
      { orderBy: { updatedAt: "DESC" } },
    );

    return { results: homeScreens };
  }

  /**
   * Creates a new HomeScreen for the authenticated user.
   */
  @ValidateUser()
  @Mutation(() => HomeScreenResponse)
  async createHomeScreen(
    @Arg("options", () => HomeScreenInput) options: HomeScreenInput,
    @Ctx() { em, request }: MyContext,
  ): Promise<HomeScreenResponse> {
    const req = request as any;

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

    const user = await em.findOne(User, { _id: req.userId });

    if (!user) {
      return {
        errors: [
          {
            field: "User",
            message: "No user found, try to log in.",
          },
        ],
      };
    }

    // Generate a unique shareable link
    const shareableLink = this.generateUniqueLink();

    const homeScreen = em.create(HomeScreen, {
      ...options,
      owner: user,
      shareableLink,
      views: 0,
    });

    try {
      await em.persistAndFlush(homeScreen);
    } catch (err) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Failed to create home screen",
          },
        ],
      };
    }

    return { results: homeScreen };
  }

  /**
   * Updates an existing HomeScreen.
   */
  @ValidateUser()
  @Mutation(() => HomeScreenResponse)
  async updateHomeScreen(
    @Arg("id", () => String) id: string,
    @Arg("options", () => HomeScreenInput) options: HomeScreenInput,
    @Ctx() { em, request }: MyContext,
  ): Promise<HomeScreenResponse> {
    const req = request as any;

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

    const homeScreen = await em.findOne(HomeScreen, { _id: new ObjectId(id) });
    if (!homeScreen) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Home screen not found",
          },
        ],
      };
    }

    // Verify ownership
    let ownerId: string;
    if (homeScreen.owner && typeof homeScreen.owner === "object" && "_id" in homeScreen.owner) {
      ownerId = homeScreen.owner._id.toString();
    } else if (homeScreen.owner) {
      ownerId = String(homeScreen.owner);
    } else {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Home screen owner not found",
          },
        ],
      };
    }

    if (ownerId !== req.userId.toString()) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "You do not have permission to update this home screen",
          },
        ],
      };
    }

    try {
      em.assign(homeScreen, options);
      await em.persistAndFlush(homeScreen);
    } catch (err) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Failed to update home screen",
          },
        ],
      };
    }

    return { results: homeScreen };
  }

  /**
   * Deletes a HomeScreen.
   */
  @ValidateUser()
  @Mutation(() => HomeScreenResponse)
  async deleteHomeScreen(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext,
  ) {
    const req = request as any;

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

    const homeScreen = await em.findOne(HomeScreen, { _id: new ObjectId(id) });

    if (!homeScreen) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Home screen not found",
          },
        ],
      };
    }

    // Verify ownership
    let ownerId: string;
    if (homeScreen.owner && typeof homeScreen.owner === "object" && "_id" in homeScreen.owner) {
      ownerId = homeScreen.owner._id.toString();
    } else if (homeScreen.owner) {
      ownerId = String(homeScreen.owner);
    } else {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Home screen owner not found",
          },
        ],
      };
    }

    if (ownerId !== req.userId.toString()) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "You do not have permission to delete this home screen",
          },
        ],
      };
    }

    try {
      await em.removeAndFlush(homeScreen);
    } catch (err) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Failed to delete home screen",
          },
        ],
      };
    }

    return { results: homeScreen };
  }

  /**
   * Increments the view count for a HomeScreen (when accessed via link).
   */
  @Mutation(() => HomeScreenResponse)
  async incrementHomeScreenViews(
    @Arg("id", () => String) id: string,
    @Ctx() { em }: MyContext,
  ): Promise<HomeScreenResponse> {
    const homeScreen = await em.findOne(HomeScreen, { _id: new ObjectId(id) });

    if (!homeScreen) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Home screen not found",
          },
        ],
      };
    }

    try {
      homeScreen.views += 1;
      homeScreen.lastViewedAt = new Date();
      await em.persistAndFlush(homeScreen);
    } catch (err) {
      return {
        errors: [
          {
            field: "HomeScreen",
            message: "Failed to increment views",
          },
        ],
      };
    }

    return { results: homeScreen };
  }

  /**
   * Generates a unique random string for shareable links.
   */
  private generateUniqueLink(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
