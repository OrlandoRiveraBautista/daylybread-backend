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
import { Media, MediaPurpose } from "../../entities/Media";
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
  url!: string;

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

  @Query(() => Media)
  async getMedia(@Arg("id") id: string, @Ctx() { em }: MyContext) {
    return await em.findOne(Media, { _id: new ObjectId(id) });
  }

  @Query(() => [Media])
  async getMediaByPurpose(
    @Arg("purpose") purpose: MediaPurpose,
    @Ctx() { em }: MyContext
  ) {
    return await em.find(Media, { purpose });
  }

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
}
