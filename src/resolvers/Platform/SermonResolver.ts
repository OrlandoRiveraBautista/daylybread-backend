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
import { Sermon, SermonStatus } from "../../entities/Sermon";
import { MyContext } from "../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";

/**
 * Input type for creating or updating a sermon
 */
@InputType()
class SermonInput {
  @Field(() => String)
  title!: string;

  @Field(() => String)
  content!: string; // Tiptap JSON content as string

  @Field(() => SermonStatus, { nullable: true })
  status?: SermonStatus;
}

/**
 * Response type for single sermon operations
 */
@ObjectType()
class SermonResponse {
  @Field(() => Sermon, { nullable: true })
  results?: Sermon;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

/**
 * Response type for multiple sermons
 */
@ObjectType()
class SermonsResponse {
  @Field(() => [Sermon], { nullable: true })
  results?: Sermon[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

/**
 * GraphQL resolver for sermon operations.
 * Handles creating, reading, updating, and deleting sermons.
 */
@Resolver()
export class SermonResolver {
  /**
   * Retrieves all sermons for the authenticated user.
   */
  @ValidateUser()
  @Query(() => SermonsResponse)
  async getSermons(@Ctx() { em, request }: MyContext): Promise<SermonsResponse> {
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

    const sermons = await em.find(
      Sermon,
      { author: req.userId },
      { orderBy: { updatedAt: "DESC" } }
    );

    // Populate author for each sermon
    for (const sermon of sermons) {
      await em.populate(sermon, ["author"]);
    }

    return { results: sermons };
  }

  /**
   * Retrieves a single sermon by ID.
   */
  @ValidateUser()
  @Query(() => SermonResponse)
  async getSermon(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SermonResponse> {
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

    const sermon = await em.findOne(Sermon, { _id: new ObjectId(id) });

    if (!sermon) {
      return {
        errors: [
          {
            field: "Sermon",
            message: "Sermon not found",
          },
        ],
      };
    }

    await em.populate(sermon, ["author"]);

    return { results: sermon };
  }

  /**
   * Creates a new sermon for the authenticated user.
   */
  @ValidateUser()
  @Mutation(() => SermonResponse)
  async createSermon(
    @Arg("options", () => SermonInput) options: SermonInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SermonResponse> {
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

    const sermon = em.create(Sermon, {
      title: options.title,
      content: options.content,
      status: options.status || SermonStatus.DRAFT,
      author: user,
    });

    try {
      await em.persistAndFlush(sermon);
    } catch (err) {
      console.error("Error creating sermon:", err);
      return {
        errors: [
          {
            field: "Sermon",
            message: "Failed to create sermon",
          },
        ],
      };
    }

    return { results: sermon };
  }

  /**
   * Updates an existing sermon.
   */
  @ValidateUser()
  @Mutation(() => SermonResponse)
  async updateSermon(
    @Arg("id") id: string,
    @Arg("options", () => SermonInput) options: SermonInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SermonResponse> {
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

    const sermon = await em.findOne(Sermon, { _id: new ObjectId(id) });

    if (!sermon) {
      return {
        errors: [
          {
            field: "Sermon",
            message: "Sermon not found",
          },
        ],
      };
    }

    try {
      em.assign(sermon, {
        title: options.title,
        content: options.content,
        status: options.status || sermon.status,
      });

      await em.persistAndFlush(sermon);
      await em.populate(sermon, ["author"]);
    } catch (err) {
      console.error("Error updating sermon:", err);
      return {
        errors: [
          {
            field: "Sermon",
            message: "Failed to update sermon",
          },
        ],
      };
    }

    return { results: sermon };
  }

  /**
   * Deletes a sermon.
   */
  @ValidateUser()
  @Mutation(() => SermonResponse)
  async deleteSermon(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SermonResponse> {
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

    const sermon = await em.findOne(Sermon, { _id: new ObjectId(id) });

    if (!sermon) {
      return {
        errors: [
          {
            field: "Sermon",
            message: "Sermon not found",
          },
        ],
      };
    }

    try {
      await em.removeAndFlush(sermon);
    } catch (err) {
      console.error("Error deleting sermon:", err);
      return {
        errors: [
          {
            field: "Sermon",
            message: "Failed to delete sermon",
          },
        ],
      };
    }

    return { results: sermon };
  }
}
