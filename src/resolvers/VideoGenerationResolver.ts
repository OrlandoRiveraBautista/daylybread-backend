import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  PubSub,
  Subscription,
  Root,
  InputType,
  Field,
  PubSubEngine,
  Int,
} from "type-graphql";
import { ObjectId } from "@mikro-orm/mongodb";

/* Types */
import { MyContext } from "../types";

/* Entity */
import {
  VideoGeneration,
  VideoStyle,
  BackgroundType,
} from "../entities/VideoGeneration";
import { FieldError } from "../entities/Errors/FieldError";
import { User } from "../entities/User";

/* Middlewares */
import { ValidateUser } from "../middlewares/userAuth";

/* Services */
import {
  VideoGenerationService,
  VideoGenerationConfig,
} from "../services/VideoGenerationService";

// Input Types
@InputType()
export class VideoGenerationInput {
  @Field()
  verseReference: string;

  @Field({ nullable: true })
  theme?: string;

  @Field({ nullable: true })
  customPrompt?: string;

  @Field(() => VideoStyle)
  style: VideoStyle = VideoStyle.TIKTOK;

  @Field(() => BackgroundType)
  backgroundType: BackgroundType = BackgroundType.STOCK_FOOTAGE;

  @Field(() => Int)
  duration: number = 60;

  @Field({ nullable: true })
  musicGenre?: string;

  @Field({ nullable: true })
  autoPost?: boolean;

  @Field(() => [String], { nullable: true })
  postingPlatforms?: string[];
}

@InputType()
export class SubtitleConfigInput {
  @Field()
  style: "dynamic" | "classic" = "dynamic";

  @Field(() => [String])
  colorScheme: string[] = ["#ffffff", "#ffff00"];

  @Field(() => Int)
  fontSize: number = 24;

  @Field()
  fontFamily: string = "Arial";

  @Field()
  emojis: boolean = true;
}

@InputType()
export class VideoGenerationWithSubtitlesInput extends VideoGenerationInput {
  @Field(() => SubtitleConfigInput, { nullable: true })
  subtitleConfig?: SubtitleConfigInput;
}

// Response Types
@InputType()
export class VideoGenerationResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => VideoGeneration, { nullable: true })
  videoGeneration?: VideoGeneration;
}

@InputType()
export class VideoGenerationListResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => [VideoGeneration], { nullable: true })
  videoGenerations?: VideoGeneration[];

  @Field(() => Int, { nullable: true })
  total?: number;
}

@Resolver()
export class VideoGenerationResolver {
  // Subscription for real-time video generation updates
  @Subscription(() => VideoGeneration, {
    topics: ({ args }) => `VIDEO_GENERATION_UPDATE_${args.videoId}`,
  })
  videoGenerationUpdated(
    @Root() videoGeneration: VideoGeneration,
    @Arg("videoId") _videoId: string
  ): VideoGeneration {
    return videoGeneration;
  }

  /**
   * Create a new video generation job
   */
  @ValidateUser()
  @Mutation(() => VideoGenerationResponse)
  async createVideoGeneration(
    @Arg("input") input: VideoGenerationWithSubtitlesInput,
    @Ctx() context: MyContext,
    @PubSub() pubSub: PubSubEngine
  ): Promise<VideoGenerationResponse> {
    try {
      // Get user ID from context
      const req = context.request as any;
      if (!req.userId) {
        return {
          errors: [
            {
              field: "user",
              message: "User not authenticated",
            },
          ],
        };
      }

      // Validate input
      const validationErrors = this.validateVideoInput(input);
      if (validationErrors.length > 0) {
        return { errors: validationErrors };
      }

      // Check user limits (optional - you might want to implement rate limiting)
      const user = await context.em.findOne(User, {
        _id: new ObjectId(req.userId),
      });
      if (!user) {
        return {
          errors: [
            {
              field: "user",
              message: "User not found",
            },
          ],
        };
      }

      // Create video generation service
      const videoService = new VideoGenerationService(
        context.em,
        context.openai
      );

      // Prepare configuration
      const config: VideoGenerationConfig = {
        verseReference: input.verseReference,
        theme: input.theme,
        customPrompt: input.customPrompt,
        style: input.style,
        backgroundType: input.backgroundType,
        duration: input.duration,
        subtitleConfig: input.subtitleConfig,
        musicGenre: input.musicGenre,
        autoPost: input.autoPost,
        postingPlatforms: input.postingPlatforms,
      };

      // Start video generation
      const videoGeneration = await videoService.generateVideo(
        req.userId,
        config
      );

      // Publish initial creation event
      await pubSub.publish(
        `VIDEO_GENERATION_UPDATE_${videoGeneration._id.toString()}`,
        videoGeneration
      );

      return { videoGeneration };
    } catch (error) {
      console.error("Video generation creation error:", error);
      return {
        errors: [
          {
            field: "general",
            message: "Failed to create video generation job",
          },
        ],
      };
    }
  }

  /**
   * Get video generation by ID
   */
  @ValidateUser()
  @Query(() => VideoGenerationResponse)
  async getVideoGeneration(
    @Arg("videoId") videoId: string,
    @Ctx() context: MyContext
  ): Promise<VideoGenerationResponse> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return {
          errors: [
            {
              field: "user",
              message: "User not authenticated",
            },
          ],
        };
      }

      const videoService = new VideoGenerationService(
        context.em,
        context.openai
      );
      const videoGeneration = await videoService.getVideoGeneration(videoId);

      if (!videoGeneration) {
        return {
          errors: [
            {
              field: "videoId",
              message: "Video generation not found",
            },
          ],
        };
      }

      // Check if user owns this video generation
      if (videoGeneration.userId !== req.userId) {
        return {
          errors: [
            {
              field: "access",
              message: "Access denied",
            },
          ],
        };
      }

      return { videoGeneration };
    } catch (error) {
      console.error("Get video generation error:", error);
      return {
        errors: [
          {
            field: "general",
            message: "Failed to fetch video generation",
          },
        ],
      };
    }
  }

  /**
   * Get user's video generations with pagination
   */
  @ValidateUser()
  @Query(() => VideoGenerationListResponse)
  async getUserVideoGenerations(
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Arg("offset", () => Int, { defaultValue: 0 }) offset: number,
    @Ctx() context: MyContext
  ): Promise<VideoGenerationListResponse> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return {
          errors: [
            {
              field: "user",
              message: "User not authenticated",
            },
          ],
        };
      }

      const videoService = new VideoGenerationService(
        context.em,
        context.openai
      );
      const videoGenerations = await videoService.getUserVideoGenerations(
        req.userId,
        limit
      );

      // Get total count for pagination
      const total = await context.em.count(VideoGeneration, {
        userId: req.userId,
      });

      return {
        videoGenerations,
        total,
      };
    } catch (error) {
      console.error("Get user video generations error:", error);
      return {
        errors: [
          {
            field: "general",
            message: "Failed to fetch video generations",
          },
        ],
      };
    }
  }

  /**
   * Cancel a video generation job
   */
  @ValidateUser()
  @Mutation(() => VideoGenerationResponse)
  async cancelVideoGeneration(
    @Arg("videoId") videoId: string,
    @Ctx() context: MyContext,
    @PubSub() pubSub: PubSubEngine
  ): Promise<VideoGenerationResponse> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return {
          errors: [
            {
              field: "user",
              message: "User not authenticated",
            },
          ],
        };
      }

      const videoService = new VideoGenerationService(
        context.em,
        context.openai
      );
      const videoGeneration = await videoService.getVideoGeneration(videoId);

      if (!videoGeneration) {
        return {
          errors: [
            {
              field: "videoId",
              message: "Video generation not found",
            },
          ],
        };
      }

      // Check if user owns this video generation
      if (videoGeneration.userId !== req.userId) {
        return {
          errors: [
            {
              field: "access",
              message: "Access denied",
            },
          ],
        };
      }

      const cancelled = await videoService.cancelVideoGeneration(videoId);

      if (!cancelled) {
        return {
          errors: [
            {
              field: "status",
              message: "Cannot cancel completed video generation",
            },
          ],
        };
      }

      // Get updated video generation
      const updatedVideoGeneration = await videoService.getVideoGeneration(
        videoId
      );

      // Publish cancellation event
      if (updatedVideoGeneration) {
        await pubSub.publish(
          `VIDEO_GENERATION_UPDATE_${videoId}`,
          updatedVideoGeneration
        );
      }

      return { videoGeneration: updatedVideoGeneration };
    } catch (error) {
      console.error("Cancel video generation error:", error);
      return {
        errors: [
          {
            field: "general",
            message: "Failed to cancel video generation",
          },
        ],
      };
    }
  }

  /**
   * Regenerate video with different parameters
   */
  @ValidateUser()
  @Mutation(() => VideoGenerationResponse)
  async regenerateVideo(
    @Arg("originalVideoId") originalVideoId: string,
    @Arg("input") input: VideoGenerationWithSubtitlesInput,
    @Ctx() context: MyContext,
    @PubSub() pubSub: PubSubEngine
  ): Promise<VideoGenerationResponse> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return {
          errors: [
            {
              field: "user",
              message: "User not authenticated",
            },
          ],
        };
      }

      const videoService = new VideoGenerationService(
        context.em,
        context.openai
      );
      const originalVideo = await videoService.getVideoGeneration(
        originalVideoId
      );

      if (!originalVideo || originalVideo.userId !== req.userId) {
        return {
          errors: [
            {
              field: "originalVideoId",
              message: "Original video not found or access denied",
            },
          ],
        };
      }

      // Use original video's verse reference if not provided
      if (!input.verseReference) {
        input.verseReference = originalVideo.verseReference;
      }

      // Validate input
      const validationErrors = this.validateVideoInput(input);
      if (validationErrors.length > 0) {
        return { errors: validationErrors };
      }

      // Create new video generation with updated parameters
      const config: VideoGenerationConfig = {
        verseReference: input.verseReference,
        theme: input.theme,
        customPrompt: input.customPrompt,
        style: input.style,
        backgroundType: input.backgroundType,
        duration: input.duration,
        subtitleConfig: input.subtitleConfig,
        musicGenre: input.musicGenre,
        autoPost: input.autoPost,
        postingPlatforms: input.postingPlatforms,
      };

      const videoGeneration = await videoService.generateVideo(
        req.userId,
        config
      );

      // Publish creation event
      await pubSub.publish(
        `VIDEO_GENERATION_UPDATE_${videoGeneration._id.toString()}`,
        videoGeneration
      );

      return { videoGeneration };
    } catch (error) {
      console.error("Regenerate video error:", error);
      return {
        errors: [
          {
            field: "general",
            message: "Failed to regenerate video",
          },
        ],
      };
    }
  }

  /**
   * Get video generation statistics for user
   */
  @ValidateUser()
  @Query(() => String)
  async getVideoGenerationStats(@Ctx() context: MyContext): Promise<string> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return JSON.stringify({ error: "User not authenticated" });
      }

      const stats = await context.em
        .createQueryBuilder(VideoGeneration)
        .select(["status", "count(*) as count"])
        .where({ userId: req.userId })
        .groupBy("status")
        .execute();

      const totalGenerated = await context.em.count(VideoGeneration, {
        userId: req.userId,
      });
      const completedToday = await context.em.count(VideoGeneration, {
        userId: req.userId,
        status: "completed",
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      });

      return JSON.stringify({
        totalGenerated,
        completedToday,
        statusBreakdown: stats,
      });
    } catch (error) {
      console.error("Get video stats error:", error);
      return JSON.stringify({ error: "Failed to fetch statistics" });
    }
  }

  /**
   * Validate video generation input
   */
  private validateVideoInput(
    input: VideoGenerationWithSubtitlesInput
  ): FieldError[] {
    const errors: FieldError[] = [];

    if (!input.verseReference || input.verseReference.trim().length === 0) {
      errors.push({
        field: "verseReference",
        message: "Verse reference is required",
      });
    }

    if (input.duration < 15 || input.duration > 90) {
      errors.push({
        field: "duration",
        message: "Duration must be between 15 and 90 seconds",
      });
    }

    if (input.customPrompt && input.customPrompt.length > 500) {
      errors.push({
        field: "customPrompt",
        message: "Custom prompt cannot exceed 500 characters",
      });
    }

    if (input.theme && input.theme.length > 100) {
      errors.push({
        field: "theme",
        message: "Theme cannot exceed 100 characters",
      });
    }

    if (input.postingPlatforms && input.postingPlatforms.length > 5) {
      errors.push({
        field: "postingPlatforms",
        message: "Cannot select more than 5 posting platforms",
      });
    }

    return errors;
  }
}

