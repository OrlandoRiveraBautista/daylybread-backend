import { Resolver, Query, Arg, Ctx } from "type-graphql";
import { MyContext } from "src/types";
import { FieldError } from "src/entities/Errors/FieldError";

@Resolver()
export class OpenAiTestResolver {
  @Query(() => String)
  async getOpen(
    @Arg("promptText", () => String) promptText: string | undefined,
    @Ctx() { chatgpt }: MyContext
  ): Promise<String | FieldError | undefined> {
    if (!promptText) return; // check to see if there is anything in the prompt

    console.log("Prompt Text:");
    console.log(promptText);

    console.log(chatgpt);

    // call ai with prompt text
    const response = await chatgpt.call({
      input: promptText,
    });

    console.log("Response:");
    console.log(response);

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
