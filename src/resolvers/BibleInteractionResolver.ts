import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  ObjectType,
} from "type-graphql";
import { ValidateUser } from "../middlewares/userAuth";
import { MyContext } from "../types";
import { User } from "../entities/User";
import {
  BibleInteraction,
  InteractionType,
} from "../entities/BibleInteraction";
import { FieldError } from "../entities/Errors/FieldError";
import { ObjectId } from "@mikro-orm/mongodb";

@ObjectType()
export class BibleInteractionResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => BibleInteraction, { nullable: true })
  results?: BibleInteraction;
}

@ObjectType()
export class GetBibleInteractionsResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => [BibleInteraction], { nullable: true })
  results?: BibleInteraction[];
}

@InputType()
export class BibleInteractionInput {
  @Field(() => String)
  bibleId: string;

  @Field(() => InteractionType)
  type: InteractionType;

  @Field(() => String)
  book: string;

  @Field(() => Number)
  chapter: number;

  @Field(() => [Number])
  verses: number[];

  @Field(() => String, { nullable: true })
  highlightColor?: string;

  @Field(() => String, { nullable: true })
  content?: string;

  @Field(() => String, { nullable: true })
  metadata?: string;
}

@Resolver()
export class BibleInteractionResolver {
  @ValidateUser()
  @Mutation(() => BibleInteractionResponse)
  async createInteraction(
    @Arg("options") options: BibleInteractionInput,
    @Ctx() { em, request }: MyContext
  ): Promise<BibleInteractionResponse> {
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
            message: "No user found, try to log in.",
          },
        ],
      };
    }

    const interaction = em.create(BibleInteraction, {
      ...options,
      user,
    });

    try {
      await em.persistAndFlush(interaction);
    } catch (err) {
      throw err;
    }

    return { results: interaction };
  }

  @ValidateUser()
  @Query(() => GetBibleInteractionsResponse)
  async getMyInteractions(
    @Arg("type", () => InteractionType, { nullable: true })
    type: InteractionType,
    @Ctx() { em, request }: MyContext
  ): Promise<GetBibleInteractionsResponse> {
    const req = request as any;

    const whereClause: any = { user: req.userId };
    if (type) {
      whereClause.type = type;
    }

    const interactions = await em.find(BibleInteraction, whereClause, {
      orderBy: [{ createdAt: -1 }],
    });

    if (!interactions.length) {
      return {
        errors: [
          {
            message: type
              ? `No ${type.toLowerCase()} interactions found`
              : "No interactions found",
          },
        ],
      };
    }

    return { results: interactions };
  }

  @ValidateUser()
  @Query(() => BibleInteractionResponse)
  async getInteraction(
    @Arg("id") id: string,
    @Ctx() { em }: MyContext
  ): Promise<BibleInteractionResponse> {
    const interaction = await em.findOne(BibleInteraction, {
      _id: new ObjectId(id),
    });

    if (!interaction) {
      return {
        errors: [
          {
            message: "Interaction not found",
          },
        ],
      };
    }

    return { results: interaction };
  }

  @ValidateUser()
  @Mutation(() => BibleInteractionResponse)
  async updateInteraction(
    @Arg("id") id: string,
    @Arg("options") options: BibleInteractionInput,
    @Ctx() { em, request }: MyContext
  ): Promise<BibleInteractionResponse> {
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

    const interaction = await em.findOne(BibleInteraction, {
      _id: new ObjectId(id),
      user: req.userId,
    });

    if (!interaction) {
      return {
        errors: [
          {
            message:
              "Interaction not found or you don't have permission to modify it",
          },
        ],
      };
    }

    try {
      em.assign(interaction, {
        ...options,
      });
      await em.persistAndFlush(interaction);
    } catch (err) {
      throw err;
    }

    return { results: interaction };
  }

  @ValidateUser()
  @Mutation(() => Boolean)
  async deleteInteraction(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<boolean> {
    const req = request as any;

    if (!req.userId) {
      throw new Error("User not authenticated");
    }

    const interaction = await em.findOne(BibleInteraction, {
      _id: new ObjectId(id),
      user: req.userId,
    });

    if (!interaction) {
      throw new Error(
        "Interaction not found or you don't have permission to delete it"
      );
    }

    try {
      await em.removeAndFlush(interaction);
      return true;
    } catch (err) {
      throw err;
    }
  }
}
