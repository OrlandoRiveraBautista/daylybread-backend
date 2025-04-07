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
import { setupChatGpt } from "../../middlewares/setupChatGpt";
import { ValidateUser } from "../../middlewares/userAuth";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";

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
    topics: ({ args }) => `AI_CHAT_RESPONSE_UPDATED_${args.deviceId}`, // Dynamic naming for the subscription
  })
  aiChatReponseUpdated(
    @Root() chatMessage: string,
    @Arg("deviceId") _deviceId: string // Need to set this so that the front end schema is correct
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
    if (!options.promptText) return; // check to see if there is anything in the prompt

    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = context.request as any;
    let user: User | undefined;

    if (req.userId) {
      user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
    }

    // Set up the chatgpt instance
    await setupChatGpt(context, options.deviceId, user);

    // call ai with prompt text
    let response;
    try {
      // Try to call the chatgpt model
      response = await context.chatgpt.call({
        input: options.promptText, // Pass in the user prompt
        // Add call backs for handling streaming
        callbacks: [
          {
            // Call one of the callbacks from openai to handle every token/stream that comes in
            async handleLLMNewToken(token: any) {
              // push it to the correct subscriber depending on their device
              await pubsub.publish(
                `AI_CHAT_RESPONSE_UPDATED_${options.deviceId}`,
                token
              );
            },
          },
        ],
      });
    } catch (e) {
      const error: FieldError = {
        message: e,
      };

      return error;
    }

    // check if there is a response, if not send error
    if (!response) {
      const error: FieldError = {
        message: "Prompt could not return anything, please try again",
      };
      return error;
    }

    // send a completion response to the subscriber
    await pubsub.publish(
      `AI_CHAT_RESPONSE_UPDATED_${options.deviceId}`,
      "[DONE]"
    );

    // return response text
    return response.response;
  }
}
