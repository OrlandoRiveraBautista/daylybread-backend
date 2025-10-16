import { Entity, PrimaryKey, Property, Index, Enum } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ObjectType, registerEnumType } from "type-graphql";

export enum VideoStatus {
  PENDING = "pending",
  GENERATING_SCRIPT = "generating_script",
  GENERATING_AUDIO = "generating_audio",
  FETCHING_BACKGROUND = "fetching_background",
  RENDERING_VIDEO = "rendering_video",
  UPLOADING = "uploading",
  COMPLETED = "completed",
  FAILED = "failed",
}

registerEnumType(VideoStatus, {
  name: "VideoStatus",
  description: "Status of video generation process",
});

export enum VideoStyle {
  TIKTOK = "tiktok",
  INSTAGRAM_REEL = "instagram_reel",
  YOUTUBE_SHORT = "youtube_short",
}

registerEnumType(VideoStyle, {
  name: "VideoStyle",
  description: "Target platform style for the video",
});

export enum BackgroundType {
  AI_GENERATED = "ai_generated",
  STOCK_FOOTAGE = "stock_footage",
  STATIC_WITH_MOTION = "static_with_motion",
}

registerEnumType(BackgroundType, {
  name: "BackgroundType",
  description: "Type of background for the video",
});

@ObjectType()
@Entity({ collection: "video_generations" })
@Index({ properties: ["userId", "createdAt"] })
@Index({ properties: ["status", "scheduledFor"] })
@Index({ properties: ["contentType", "createdAt"] })
export class VideoGeneration {
  @Field(() => String)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property()
  @Index()
  userId!: string;

  // Content source
  @Field(() => String)
  @Property()
  verseReference!: string; // e.g., "John 3:16" or "David & Goliath"

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  theme?: string; // Optional theme for more specific content

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  customPrompt?: string; // Custom user prompt

  // Video configuration
  @Field(() => VideoStyle)
  @Enum(() => VideoStyle)
  @Property()
  style: VideoStyle = VideoStyle.TIKTOK;

  @Field(() => BackgroundType)
  @Enum(() => BackgroundType)
  @Property()
  backgroundType: BackgroundType = BackgroundType.STOCK_FOOTAGE;

  @Field(() => Number)
  @Property()
  duration: number = 60; // Duration in seconds (30-60)

  // Generation status and progress
  @Field(() => VideoStatus)
  @Enum(() => VideoStatus)
  @Property()
  status: VideoStatus = VideoStatus.PENDING;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  errorMessage?: string;

  @Field(() => Number)
  @Property()
  progress: number = 0; // Progress percentage (0-100)

  // Generated content
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  generatedScript?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  audioUrl?: string; // S3 URL for generated audio

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  backgroundVideoUrl?: string; // S3 URL for background video/image

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  finalVideoUrl?: string; // S3 URL for final video

  // Subtitle configuration
  @Field(() => String, { nullable: true })
  @Property({ type: "json", nullable: true })
  subtitleConfig?: {
    style: "dynamic" | "classic";
    colorScheme: string[];
    fontSize: number;
    fontFamily: string;
    emojis: boolean;
  };

  // Music configuration
  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  musicGenre?: string; // "lo-fi", "cinematic", "worship"

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  musicUrl?: string; // S3 URL for background music

  // Metadata
  @Field(() => String, { nullable: true })
  @Property({ type: "json", nullable: true })
  metadata?: {
    renderTime?: number; // Time taken to render (in seconds)
    audioLength?: number; // Audio duration (in seconds)
    voiceModel?: string; // TTS model used
    backgroundSource?: string; // Source of background (Pexels, Unsplash, etc.)
    scriptTokens?: number; // Number of tokens used for script generation
    estimatedCost?: number; // Estimated cost of generation
  };

  // Scheduling
  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  scheduledFor?: Date; // For automated generation

  // Auto-posting configuration
  @Field(() => Boolean)
  @Property()
  autoPost: boolean = false;

  @Field(() => String, { nullable: true })
  @Property({ type: "json", nullable: true })
  postingPlatforms?: string[]; // ["tiktok", "instagram", "youtube"]

  // Timestamps
  @Field(() => Date)
  @Property()
  createdAt: Date = new Date();

  @Field(() => Date)
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  completedAt?: Date;
}

