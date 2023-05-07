import { Resolver, Query, Arg, Ctx } from "type-graphql";
import { MyContext } from "../../types";
import { FieldError } from "../../entities/Errors/FieldError";
import { BreadCrumbsResponse } from "../../entities/Test";

@Resolver()
export class OpenAiTestResolver {
  @Query(() => BreadCrumbsResponse)
  async getOpen(
    @Arg("promptText", () => String) promptText: string | undefined,
    @Ctx() { chatgpt }: MyContext
  ): Promise<BreadCrumbsResponse | FieldError | undefined> {
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

    const res: BreadCrumbsResponse = {
      response: response.response,
    };

    // return response text
    return res;
  }
}
