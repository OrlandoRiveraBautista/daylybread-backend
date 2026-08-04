import {
  Resolver,
  Query,
  Arg,
  Ctx,
  PubSub,
  Subscription,
  Root,
  InputType,
  Field,
  PubSubEngine,
} from "type-graphql";

/* Types */
import { MyContext } from "../../types";

/* Entity */
import { FieldError } from "../../entities/Errors/FieldError";

/* Middlewares */
import { ValidateUser } from "../../middlewares/userAuth";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { runBibleChat } from "../../misc/ai/chatService";
import { toSafeAiErrorMessage } from "../../misc/ai/errors";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class GptArgs {
  @Field()
  promptText: string;

  @Field()
  deviceId: string;
}

@Resolver()
export class OpenAiTestResolver {
  @Subscription(() => String, {
    topics: ({ args }) => `AI_CHAT_RESPONSE_UPDATED_${args.deviceId}`,
  })
  aiChatReponseUpdated(
    @Root() chatMessage: string,
    @Arg("deviceId") _deviceId: string
  ): string {
    return chatMessage;
  }

  @ValidateUser()
  @Query(() => String)
  async getOpen(
    @Arg("options", () => GptArgs) options: GptArgs,
    @Ctx() context: MyContext,
    @PubSub() pubsub: PubSubEngine
  ): Promise<String | FieldError | undefined> {
    if (!options.promptText) return;

    if (!options.deviceId?.trim()) {
      return { message: "deviceId is required" };
    }

    const req = context.request as any;
    let user: User | undefined;

    if (req.userId) {
      user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
    }

    try {
      const response = await runBibleChat({
        em: context.em,
        user,
        deviceId: options.deviceId,
        promptText: options.promptText,
        onToken: async (token) => {
          await pubsub.publish(
            `AI_CHAT_RESPONSE_UPDATED_${options.deviceId}`,
            token
          );
        },
      });

      await pubsub.publish(
        `AI_CHAT_RESPONSE_UPDATED_${options.deviceId}`,
        "[DONE]"
      );

      return response;
    } catch (e) {
      const message = toSafeAiErrorMessage(e);
      await pubsub.publish(
        `AI_CHAT_RESPONSE_UPDATED_${options.deviceId}`,
        `[ERROR] ${message}`
      );
      return { message };
    }
  }
}
