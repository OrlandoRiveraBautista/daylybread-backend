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
import { MyContext } from "../../types";
import { FieldError } from "../../entities/Errors/FieldError";
import { setupChatGpt } from "../../middlewares/setupChatGpt";

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

  @Query(() => String)
  async getOpen(
    @Arg("options", () => GptArgs) options: GptArgs,
    @Ctx() context: MyContext,
    @PubSub() pubsub: PubSubEngine
  ): Promise<String | FieldError | undefined> {
    if (!options.promptText) return; // check to see if there is anything in the prompt

    await setupChatGpt(context, options.deviceId);

    // call ai with prompt text
    let response;
    try {
      response = await context.chatgpt.call({
        input: options.promptText,
        callbacks: [
          {
            async handleLLMNewToken(token: any) {
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

    // return response text
    return response.response;
  }
}
