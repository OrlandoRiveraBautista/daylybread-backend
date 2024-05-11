import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { AudioMediaResponse } from "./types";
import BibleBrainService from "../../../services/BibleBrainService";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class AudioMediaArgs {
  @Field()
  filesetId: string;

  @Field()
  bookId: string;

  @Field()
  chapterNumber: number;
}

/**
 * Resolver to get all books for a given bible by bible id
 */
@Resolver()
export class MediaResolver {
  @Query(() => AudioMediaResponse || FieldError)
  async getAudioMedia(
    @Arg("options", () => AudioMediaArgs) options: AudioMediaArgs
  ) {
    if (!options.filesetId) {
      const error: FieldError = {
        message: "Please specify a filesetId",
        field: "filesetId",
      };

      return error;
    }

    const service = new BibleBrainService();

    console.log(service);

    try {
      const data = await service.getMedia(
        options.filesetId,
        options.bookId,
        options.chapterNumber
      );
      return data;
    } catch (err) {
      const error: FieldError = {
        message: err,
        field: "Calling to get media information from bible brain.",
      };

      return error;
    }
  }
}
