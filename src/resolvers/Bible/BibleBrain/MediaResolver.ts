import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { AudioMediaResponse, MediaTimestampResponse } from "./types";
import { getBibleBrainService } from "../../../services/BibleBrainService";
import { toBibleBrainError } from "./error";

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
 * Resolver for Bible Brain audio media and timestamps.
 */
@Resolver()
export class MediaResolver {
  @Query(() => AudioMediaResponse)
  async getAudioMedia(
    @Arg("options", () => AudioMediaArgs) options: AudioMediaArgs
  ): Promise<AudioMediaResponse | FieldError> {
    if (!options.filesetId) {
      return {
        message: "Please specify a filesetId",
        field: "filesetId",
      };
    }
    if (!options.bookId) {
      return {
        message: "Please specify bookId",
        field: "bookId",
      };
    }
    if (options.chapterNumber == null) {
      return {
        message: "Please specify chapterNumber",
        field: "chapterNumber",
      };
    }

    const service = getBibleBrainService();

    try {
      return await service.getMedia(
        options.filesetId,
        options.bookId,
        options.chapterNumber
      );
    } catch (err) {
      return toBibleBrainError(err, "getAudioMedia");
    }
  }

  @Query(() => MediaTimestampResponse)
  async getMediaTimestamps(
    @Arg("options", () => AudioMediaArgs) options: AudioMediaArgs
  ): Promise<MediaTimestampResponse | FieldError> {
    if (!options.filesetId) {
      return {
        message: "Please specify a filesetId",
        field: "filesetId",
      };
    }
    if (!options.bookId) {
      return {
        message: "Please specify bookId",
        field: "bookId",
      };
    }
    if (options.chapterNumber == null) {
      return {
        message: "Please specify chapterNumber",
        field: "chapterNumber",
      };
    }

    const service = getBibleBrainService();

    try {
      return await service.getMediaTimestamps(
        options.filesetId,
        options.bookId,
        options.chapterNumber
      );
    } catch (err) {
      return toBibleBrainError(err, "getMediaTimestamps");
    }
  }
}
