import { Arg, Ctx, Field, ObjectType, Query, Resolver } from "type-graphql";
import Replicate from "replicate";
import { FieldError } from "../../entities/Errors/FieldError";
import { MyContext } from "../../types";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

const parser = new StringOutputParser();

// Initialize the Flux-Schnell model
const replicate = new Replicate();

@ObjectType()
class GenerateImageResponse {
  @Field(() => [String], { nullable: true })
  generatedImage?: string[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class GenerateImageResolver {
  @Query(() => GenerateImageResponse)
  async generateImage(
    @Arg("prompt") prompt: string,
    @Ctx() { chatgpt }: MyContext
  ): Promise<GenerateImageResponse> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    // const req = request as any;

    // if (!req.userId) {
    //   const error: GenerateImageResponse = {
    //     errors: [
    //       {
    //         message:
    //           "You need to be signed in to generate an image. Please sign in and try again",
    //         field: "Generate Image",
    //       },
    //     ],
    //   };

    //   return error;
    // }

    const messages = [
      new SystemMessage(
        "With the given text, create a prompt for an text to image generator, specifically the flux-schnell engine. Make sure that its a vivid image. Do not give me any templating just the prompt. Also make sure that it is biblically active."
      ),
      new HumanMessage(prompt),
    ];

    const result = await chatgpt.invoke(messages);

    const imageGeneratorPrompt = await parser.invoke(result);
    console.log(imageGeneratorPrompt);

    try {
      const res = (await replicate.run("black-forest-labs/flux-schnell", {
        input: {
          prompt: imageGeneratorPrompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 80,
          num_inference_steps: 4,
        },
      })) as string[]; // Pass the prompt for image generation
      //   console.log("Generated Image URL:", Object.keys(res)); // Output the generated image URL

      return { generatedImage: res };
    } catch (error) {
      console.error("Error generating image:", error);
      return { errors: [{ message: error, field: "Generate Image" }] };
    }
  }
}
