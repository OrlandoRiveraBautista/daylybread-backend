import {
  Resolver,
  Query,
  Arg,
  Ctx,
  PubSub,
  Subscription,
  Root,
  Publisher,
  InputType,
  Field,
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
    topics: "AI_CHAT_RESPONSE_UPDATED",
  })
  aiChatReponseUpdated(@Root() chatMessage: string): string {
    return chatMessage;
  }

  @Query(() => String)
  async getOpen(
    @Arg("options", () => GptArgs) options: GptArgs,
    @Ctx() context: MyContext,
    @PubSub("AI_CHAT_RESPONSE_UPDATED") publish: Publisher<String>
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
              await publish(token);
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
