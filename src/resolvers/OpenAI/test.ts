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
import {
  chatChannelKey,
  claimStreamChannelIfAvailable,
  isStreamChannelOwner,
  isValidDeviceChannelId,
} from "../../misc/ai/streamSessionOwnership";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class GptArgs {
  @Field()
  promptText: string;

  @Field()
  deviceId: string;
}

function assertChatSubscriptionAccess(
  args: { deviceId: string },
  context: MyContext
): string {
  if (!isValidDeviceChannelId(args.deviceId)) {
    throw new Error("Invalid deviceId for chat subscription.");
  }

  const deviceId = args.deviceId.trim();
  if (!context.deviceId || context.deviceId !== deviceId) {
    throw new Error(
      "Chat subscription requires a matching deviceId on the WebSocket connection."
    );
  }

  const ownerKey = `device:${deviceId}`;
  if (!claimStreamChannelIfAvailable(chatChannelKey(deviceId), ownerKey)) {
    throw new Error("This chat stream channel is already in use.");
  }

  return deviceId;
}

@Resolver()
export class OpenAiTestResolver {
  @Subscription(() => String, {
    topics: ({ args, context }) => {
      const deviceId = assertChatSubscriptionAccess(
        args as { deviceId: string },
        context as MyContext
      );
      return `AI_CHAT_RESPONSE_UPDATED_${deviceId}`;
    },
    filter: ({ args, context }) => {
      const ctx = context as MyContext;
      const deviceId = String(args.deviceId || "").trim();
      if (!ctx.deviceId || ctx.deviceId !== deviceId) return false;
      return isStreamChannelOwner(
        chatChannelKey(deviceId),
        `device:${deviceId}`
      );
    },
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

    if (!isValidDeviceChannelId(options.deviceId)) {
      return { message: "deviceId must be a valid UUID" };
    }

    const deviceId = options.deviceId.trim();
    const req = context.request as any;
    let user: User | undefined;

    if (req.userId) {
      user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
    }

    if (
      !claimStreamChannelIfAvailable(
        chatChannelKey(deviceId),
        `device:${deviceId}`
      )
    ) {
      return { message: "This chat stream channel is already in use." };
    }

    try {
      const response = await runBibleChat({
        em: context.em,
        user,
        deviceId,
        promptText: options.promptText,
        onToken: async (token) => {
          await pubsub.publish(
            `AI_CHAT_RESPONSE_UPDATED_${deviceId}`,
            token
          );
        },
      });

      await pubsub.publish(
        `AI_CHAT_RESPONSE_UPDATED_${deviceId}`,
        "[DONE]"
      );

      return response;
    } catch (e) {
      const message = toSafeAiErrorMessage(e);
      await pubsub.publish(
        `AI_CHAT_RESPONSE_UPDATED_${deviceId}`,
        `[ERROR] ${message}`
      );
      return { message };
    }
  }
}
