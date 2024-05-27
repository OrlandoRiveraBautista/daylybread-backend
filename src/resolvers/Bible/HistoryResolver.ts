import { MyContext } from "src/types";
import {
  Resolver,
  Ctx,
  Arg,
  Mutation,
  Field,
  InputType,
  ObjectType,
} from "type-graphql";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";
import { User } from "../../entities/User";
import { BibleHistory, History } from "../../entities/Bible/BibleHistory";

@InputType()
class HistoryOptions {
  @Field()
  bibleAbbr: string;

  @Field()
  bookId: string;

  @Field()
  chapterNumber: number;

  @Field()
  language: number;
}

@ObjectType()
class HistoryResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => Boolean, { nullable: true })
  results?: Boolean;
}

@Resolver()
export class HistoryResolver {
  @ValidateUser()
  @Mutation(() => HistoryResponse)
  async setUserHistory(
    @Arg("options", () => HistoryOptions) options: HistoryOptions,
    @Ctx() { em, request }: MyContext
  ): Promise<HistoryResponse> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = request as any;
    let user; // user to be set later

    // check to see if the header was set from the middleware
    if (!req.userId) {
      const error: HistoryResponse = {
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
    user = await em.findOne(User, { _id: req.userId });

    // throw error if user is not found
    if (!user) {
      const error: HistoryResponse = {
        errors: [
          {
            message: `No user found, try to log in.`,
          },
        ],
      };
      return error;
    }

    // create the history for the current text that is being accessed
    const currentHistory: History = {
      bibleAbbr: options.bibleAbbr,
      bookId: options.bookId,
      chapterNumber: options.chapterNumber,
      language: options.language,
      viewedAt: new Date(),
    };

    // try to find a history
    let userHistory = await em.findOne(BibleHistory, { owner: user._id });

    // check if the user does not have a history
    if (!userHistory) {
      // create a new history
      userHistory = em.create(BibleHistory, {
        owner: user,
        history: [currentHistory],
        current: true,
      });
    } else {
      // update the userHistory
      em.assign(userHistory, {
        history: [currentHistory, ...userHistory.history],
      });
    }

    // save the changes
    try {
      console.log(userHistory);
      await em.persistAndFlush(userHistory);
      return { results: true };
    } catch (err) {
      console.log(err);
      return {
        errors: [
          { field: "Updating history", message: "Failed to update the db" },
        ],
      };
    }
  }
}
