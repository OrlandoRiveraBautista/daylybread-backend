import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  InputType,
  Field,
  ObjectType,
} from "type-graphql";
import { Media, MediaCache, MediaPurpose } from "../../entities/Media";
import { MyContext } from "../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@InputType()
class MediaInput {
  @Field(() => String)
  fileKey!: string;

  @Field(() => String)
  filename!: string;

  @Field(() => String)
  mimeType!: string;

  @Field(() => Number)
  size!: number;

  @Field(() => MediaPurpose)
  purpose!: MediaPurpose;

  @Field(() => Boolean, { defaultValue: false })
  isPublic?: boolean;

  @Field(() => String, { nullable: true })
  description?: string;
}

@InputType()
class SignedUrlInput {
  @Field(() => String)
  filename!: string;

  @Field(() => String)
  mimeType!: string;

  @Field(() => MediaPurpose)
  purpose!: MediaPurpose;
}

@ObjectType()
class GetSignedUrlResponse {
  @Field(() => String, { nullable: true })
  signedUrl?: string;

  @Field(() => String, { nullable: true })
  fileKey?: string;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class PostSignedUrlResponse {
  @Field(() => String, { nullable: true })
  signedUrl?: string;

  @Field(() => String, { nullable: true })
  fields?: string;

  @Field(() => String, { nullable: true })
  fileKey?: string;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class MediaResponse {
  @Field(() => Media, { nullable: true })
  results?: Media;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class MediaUrlResponse {
  @Field(() => String, { nullable: true })
  signedUrl?: string;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class MediaResolver {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: "us-east-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  // Helper method to generate cache for a media item
  private async generateCacheForMedia(media: Media): Promise<{
    success: boolean;
    cache?: MediaCache;
    error?: string;
  }> {
    try {
      // Get cache duration based on media purpose
      const cacheDuration = media.getCacheDuration();

      const command = new GetObjectCommand({
        Bucket: "daylybread",
        Key: media.fileKey,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: cacheDuration,
      });

      const cache: MediaCache = {
        url: signedUrl,
        expiresAt: new Date(Date.now() + cacheDuration * 1000),
        duration: cacheDuration,
      };

      return {
        success: true,
        cache,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get a signed URL to get a file from S3
   * @param options - The options for the signed URL
   * @param request - The request context
   * @returns A signed URL for the file
   */
  @ValidateUser()
  @Mutation(() => GetSignedUrlResponse)
  async getGetSignedUrl(
    @Arg("options", () => SignedUrlInput) options: SignedUrlInput,
    @Ctx() { request }: MyContext
  ): Promise<GetSignedUrlResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    try {
      const fileKey = `user-media/${req.userId}/${
        options.purpose
      }/${Date.now()}-${options.filename}`;

      const command = new GetObjectCommand({
        Bucket: "daylybread",
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
        signableHeaders: new Set(["host", "content-type"]),
      });

      return {
        signedUrl,
        fileKey,
      };
    } catch (err) {
      console.error("S3 Error:", err);
      return {
        errors: [
          {
            field: "S3",
            message: "Failed to generate signed URL",
          },
        ],
      };
    }
  }

  /**
   * Get a signed URL for a file to upload to S3
   * @param options - The options for the signed URL
   * @param request - The request context
   * @returns A signed URL for the file
   */
  @ValidateUser()
  @Mutation(() => PostSignedUrlResponse)
  async getPostSignedUrl(
    @Arg("options", () => SignedUrlInput) options: SignedUrlInput,
    @Ctx() { request }: MyContext
  ): Promise<PostSignedUrlResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const fileKey = `user-media/${req.userId}/${
      options.purpose
    }/${Date.now()}-${options.filename}`;

    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: "daylybread",
      Key: fileKey,
      Conditions: [
        ["content-length-range", 0, 10485760], // up to 10 MB
        { "x-amz-acl": "public-read" },
        { "Content-Type": options.mimeType },
      ],
      Fields: {
        "Content-Type": options.mimeType,
        "x-amz-acl": "public-read",
      },
      Expires: 3600,
    });

    return {
      signedUrl: url,
      fields: JSON.stringify(fields),
      fileKey,
    };
  }

  /**
   * Get a media by id
   * @param id - The id of the media
   * @param em - The entity manager
   * @returns The media
   */
  @Query(() => Media)
  async getMedia(@Arg("id") id: string, @Ctx() { em }: MyContext) {
    return await em.findOne(Media, { _id: new ObjectId(id) });
  }

  /**
   * Get media by purpose
   * @param purpose - The purpose of the media
   * @param em - The entity manager
   * @returns The media
   */
  @Query(() => [Media])
  async getMediaByPurpose(
    @Arg("purpose") purpose: MediaPurpose,
    @Ctx() { em }: MyContext
  ) {
    return await em.find(Media, { purpose });
  }

  /**
   * Create a media
   * @param options - The options for the media
   * @param request - The request context
   * @returns The media
   */
  @ValidateUser()
  @Mutation(() => MediaResponse)
  async createMedia(
    @Arg("options", () => MediaInput) options: MediaInput,
    @Ctx() { em, request }: MyContext
  ): Promise<MediaResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const user = await em.findOne(User, { _id: req.userId });

    if (!user) {
      return {
        errors: [
          {
            field: "User",
            message: "No user found, try to log in.",
          },
        ],
      };
    }

    const media = em.create(Media, {
      ...options,
      owner: user,
      isPublic: options.isPublic || false,
    });

    const cache = await this.generateCacheForMedia(media);
    if (cache.success) {
      media.cache = cache.cache;
    } else {
      console.error("Failed to generate cache for media", cache.error);
    }

    try {
      await em.persistAndFlush(media);
    } catch (err) {
      return {
        errors: [
          {
            field: "Media",
            message: "Failed to create media",
          },
        ],
      };
    }

    return { results: media };
  }

  @ValidateUser()
  @Mutation(() => MediaResponse)
  async updateMedia(
    @Arg("options", () => MediaInput) options: MediaInput,
    @Arg("id", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<MediaResponse> {
    const media = await em.findOne(Media, { _id: new ObjectId(id) });

    if (!media) {
      return {
        errors: [
          {
            field: "Media",
            message: "Media not found",
          },
        ],
      };
    }

    em.assign(media, options);

    try {
      await em.persistAndFlush(media);
    } catch (err) {
      return {
        errors: [
          {
            field: "Media",
            message: "Failed to update media",
          },
        ],
      };
    }

    return { results: media };
  }

  @ValidateUser()
  @Mutation(() => MediaResponse)
  async deleteMedia(
    @Arg("id") id: string,
    @Ctx() { em }: MyContext
  ): Promise<MediaResponse> {
    const media = await em.findOne(Media, { _id: new ObjectId(id) });

    if (!media) {
      return {
        errors: [
          {
            field: "Media",
            message: "Media not found",
          },
        ],
      };
    }

    try {
      await em.removeAndFlush(media);
    } catch (err) {
      return {
        errors: [
          {
            field: "Media",
            message: "Failed to delete media",
          },
        ],
      };
    }

    return { results: media };
  }

  @ValidateUser()
  @Query(() => MediaUrlResponse)
  async getMediaUrl(
    @Arg("fileKey", () => String) fileKey: string
  ): Promise<MediaUrlResponse> {
    try {
      const command = new GetObjectCommand({
        Bucket: "daylybread",
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // URL expires in 1 hour
      });

      return {
        signedUrl,
      };
    } catch (err) {
      console.error("S3 Error:", err);
      return {
        errors: [
          {
            field: "S3",
            message: "Failed to generate signed URL for GET",
          },
        ],
      };
    }
  }

  // Method to get cache stats
  @Query(() => String)
  async getMediaCacheInfo(
    @Arg("id", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<string> {
    const media = await em.findOne(Media, { _id: new ObjectId(id) });

    if (!media || !media.cache) {
      return "No cache information available";
    }

    const now = new Date();
    const isExpired = media.cache.expiresAt
      ? now > media.cache.expiresAt
      : true;
    const timeLeft = media.cache.expiresAt
      ? Math.max(0, media.cache.expiresAt.getTime() - now.getTime()) / 1000
      : 0;

    return `Cache Status: ${
      isExpired ? "EXPIRED" : "VALID"
    }, Time Left: ${Math.floor(timeLeft)}s, Duration: ${media.cache.duration}s`;
  }

  @ValidateUser()
  @Mutation(() => MediaResponse)
  async refreshMediaCache(
    @Arg("id", () => String) id: string,
    @Arg("longTerm", () => Boolean, { defaultValue: false }) longTerm: boolean,
    @Ctx() { em, request }: MyContext
  ): Promise<MediaResponse> {
    try {
      const req = request as any;

      if (!req.userId) {
        return {
          errors: [
            {
              field: "User",
              message: "User cannot be found. Please login first.",
            },
          ],
        };
      }

      const media = await em.findOne(Media, { _id: new ObjectId(id) });

      if (!media) {
        return {
          errors: [
            {
              field: "Media",
              message: "Media not found",
            },
          ],
        };
      }

      // Generate new cache duration
      const cacheDuration = longTerm ? 604800 : media.getCacheDuration();

      const command = new GetObjectCommand({
        Bucket: "daylybread",
        Key: media.fileKey,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: cacheDuration,
      });

      media.cache = {
        url: signedUrl,
        expiresAt: new Date(Date.now() + cacheDuration * 1000),
        duration: cacheDuration,
      };

      await em.persistAndFlush(media);

      return { results: media };
    } catch (err) {
      console.error("Failed to regenerate cache", err);
      return {
        errors: [
          {
            field: "Media",
            message: "Failed to regenerate cache",
          },
        ],
      };
    }
  }
}
