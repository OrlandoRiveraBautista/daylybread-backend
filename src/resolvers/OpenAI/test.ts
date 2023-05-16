import { Resolver, Query, Arg, Ctx } from "type-graphql";
import { MyContext } from "../../types";
import { FieldError } from "../../entities/Errors/FieldError";

@Resolver()
export class OpenAiTestResolver {
  @Query(() => String)
  async getOpen(
    @Arg("promptText", () => String) promptText: string | undefined,
    @Ctx() { chatgpt }: MyContext
  ): Promise<String | FieldError | undefined> {
    if (!promptText) return; // check to see if there is anything in the prompt

    // call ai with prompt text
    let response;

    try {
      response = await chatgpt.call({
        input: promptText,
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
