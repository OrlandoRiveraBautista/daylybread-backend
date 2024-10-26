import {
  Arg,
  // Ctx,
  Field,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import Replicate from "replicate";
// import { MyContext } from "../../types";
import { FieldError } from "../../entities/Errors/FieldError";

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
    @Arg("prompt") prompt: string
    // @Ctx() { request }: MyContext
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

    try {
      const res = (await replicate.run("black-forest-labs/flux-schnell", {
        input: { prompt },
      })) as string[]; // Pass the prompt for image generation
      console.log("Generated Image URL:", Object.keys(res)); // Output the generated image URL

      return { generatedImage: res };
    } catch (error) {
      console.error("Error generating image:", error);
      return { errors: [{ message: error, field: "Generate Image" }] };
    }
  }
}
