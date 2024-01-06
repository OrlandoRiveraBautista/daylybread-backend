import {
  Resolver,
  Query,
  Arg,
  Ctx,
  PubSub,
  Subscription,
  Root,
  Publisher,
} from "type-graphql";
import { MyContext } from "../../types";
import { FieldError } from "../../entities/Errors/FieldError";
import { SetupChatGpt } from "../../middlewares/setupChatGpt";

@Resolver()
export class OpenAiTestResolver {
  @Subscription(() => String, {
    topics: "AI_CHAT_RESPONSE_UPDATED",
  })
  aiChatReponseUpdated(@Root() chatMessage: string): string {
    return chatMessage;
  }

  @SetupChatGpt()
  @Query(() => String)
  async getOpen(
    @Arg("promptText", () => String) promptText: string | undefined,
    @Ctx() { chatgpt }: MyContext,
    @PubSub("AI_CHAT_RESPONSE_UPDATED") publish: Publisher<String>
  ): Promise<String | FieldError | undefined> {
    if (!promptText) return; // check to see if there is anything in the prompt

    // call ai with prompt text
    let response;
    try {
      response = await chatgpt.call({
        input: promptText,
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
