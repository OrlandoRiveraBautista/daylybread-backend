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
import { NFCConfig, SocialMediaSettings } from "../../entities/NFCConfig";
import { MyContext } from "../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";
import { Media } from "../../entities/Media";

/**
 * Input type for configuring social media settings visibility
 */
@InputType()
class SocialMediaSettingsInput {
  @Field(() => Boolean, { nullable: true })
  facebook?: boolean;

  @Field(() => Boolean, { nullable: true })
  instagram?: boolean;

  @Field(() => Boolean, { nullable: true })
  twitter?: boolean;
}

/**
 * Input type for configuring link settings with visibility and URL
 */
@InputType()
class LinkSettingsInput {
  @Field(() => Boolean, { nullable: true })
  isVisible?: boolean;

  @Field(() => String, { nullable: true })
  url?: string;
}

/**
 * Input type for the main button configuration
 */
@InputType()
class MainButtonInput {
  @Field(() => String)
  url!: string;

  @Field(() => String)
  text!: string;
}

/**
 * Input type for creating or updating NFC configuration
 */
@InputType()
class NFCConfigInput {
  /** The type of NFC config (e.g., "file", "url") */
  @Field(() => String)
  type!: string;

  /** The title of the NFC configuration */
  @Field(() => String)
  title!: string;

  /** The description of the NFC configuration */
  @Field(() => String)
  description!: string;

  /** Main button configuration */
  @Field(() => MainButtonInput)
  mainButton!: MainButtonInput;

  /** Social media settings configuration */
  @Field(() => SocialMediaSettingsInput, { nullable: true })
  socialMedia?: SocialMediaSettingsInput;

  /** Giving/donation link configuration */
  @Field(() => LinkSettingsInput, { nullable: true })
  givingLink?: LinkSettingsInput;

  /** Member registration link configuration */
  @Field(() => LinkSettingsInput, { nullable: true })
  memberRegistrationLink?: LinkSettingsInput;

  /** Events link configuration */
  @Field(() => LinkSettingsInput, { nullable: true })
  eventsLink?: LinkSettingsInput;

  /** Optional media ID for file-type configurations */
  @Field(() => String, { nullable: true })
  mediaId?: string;
}

/**
 * Response type for NFC configuration operations
 */
@ObjectType()
class NFCConfigResponse {
  @Field(() => NFCConfig, { nullable: true })
  results?: NFCConfig;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

/**
 * GraphQL resolver for NFC configuration operations.
 * Handles creating, reading, updating, and deleting NFC configurations
 * with associated media and user authentication.
 */
@Resolver()
export class NFCConfigResolver {
  /**
   * Populates the media field of an NFCConfig entity with the associated Media object.
   * Only performs the population if the NFCConfig has a mediaId and type is "file".
   *
   * @param nfcConfig - The NFCConfig entity to populate with media data
   * @param em - The MikroORM entity manager instance for database operations
   * @returns Promise<void> - Resolves when the media population is complete
   */
  static async populateMedia(nfcConfig: NFCConfig, em: any): Promise<void> {
    if (nfcConfig.mediaId && nfcConfig.type === "file") {
      const media = await em.findOne(Media, {
        _id: new ObjectId(nfcConfig.mediaId),
      });
      if (media) {
        nfcConfig.media = media;
      }
    }
  }

  /**
   * Efficiently populates media for multiple NFCConfig entities using batch queries.
   * Reduces database calls by fetching all required media in a single query.
   *
   * @param nfcConfigs - Array of NFCConfig entities to populate with media
   * @param em - The MikroORM entity manager instance for database operations
   * @returns Promise<void> - Resolves when all media population is complete
   */
  static async populateMediaForConfigs(
    nfcConfigs: NFCConfig[],
    em: any
  ): Promise<void> {
    const mediaIds = nfcConfigs
      .filter((config) => config.mediaId && config.type === "file")
      .map((config) => new ObjectId(config.mediaId!));

    if (mediaIds.length === 0) return;

    const mediaItems = await em.find(Media, { _id: { $in: mediaIds } });
    const mediaMap = new Map(
      mediaItems.map((media: Media) => [media._id.toString(), media])
    );

    nfcConfigs.forEach((config) => {
      if (config.mediaId && config.type === "file") {
        const media = mediaMap.get(config.mediaId);
        if (media) {
          config.media = media as Media;
        }
      }
    });
  }

  /**
   * Retrieves a single NFC configuration by ID.
   * Automatically populates associated media if applicable.
   *
   * @param id - The ObjectId string of the NFC configuration to retrieve
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigResponse> - The NFC configuration or error details
   */
  @Query(() => NFCConfigResponse)
  async getNFCConfig(@Arg("id") id: string, @Ctx() { em }: MyContext) {
    const nfcConfig = await em.findOne(NFCConfig, { _id: new ObjectId(id) });
    if (!nfcConfig) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "NFC config not found",
          },
        ],
      };
    }

    await NFCConfigResolver.populateMedia(nfcConfig, em);

    return { results: nfcConfig };
  }

  /**
   * Retrieves an NFC configuration by owner ID.
   * Useful for getting a user's current NFC configuration.
   *
   * @param ownerId - The ObjectId string of the user who owns the NFC configuration
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigResponse> - The NFC configuration or error details
   */
  @Query(() => NFCConfigResponse)
  async getNFCConfigByOwner(
    @Arg("ownerId") ownerId: string,
    @Ctx() { em }: MyContext
  ) {
    const nfcConfig = await em.findOne(NFCConfig, { owner: ownerId });
    if (!nfcConfig) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "NFC config not found",
          },
        ],
      };
    }

    await NFCConfigResolver.populateMedia(nfcConfig, em);

    return { results: nfcConfig };
  }

  /**
   * Creates a new NFC configuration for the authenticated user.
   * Requires user authentication via ValidateUser middleware.
   *
   * @param options - The NFC configuration data to create
   * @param em - Database entity manager from GraphQL context
   * @param request - HTTP request object containing user authentication data
   * @returns Promise<NFCConfigResponse> - The created NFC configuration or error details
   */
  @ValidateUser()
  @Mutation(() => NFCConfigResponse)
  async createNFCConfig(
    @Arg("options", () => NFCConfigInput) options: NFCConfigInput,
    @Ctx() { em, request }: MyContext
  ): Promise<NFCConfigResponse> {
    const req = request as any;

    // check to see if the header was set from the middleware
    if (!req.userId) {
      const error: FieldError = {
        field: "User",
        message: "User cannot be found. Please login first.",
      };

      return { errors: [error] };
    }

    const user = await em.findOne(User, { _id: req.userId });

    // throw error if user is not found
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

    const socialMediaSettings = new SocialMediaSettings();
    if (options.socialMedia) {
      socialMediaSettings.facebook = options.socialMedia.facebook ?? false;
      socialMediaSettings.instagram = options.socialMedia.instagram ?? false;
      socialMediaSettings.twitter = options.socialMedia.twitter ?? false;
    }

    const nfcConfig = em.create(NFCConfig, {
      ...options,
      owner: user,
      nfcIds: [],
      socialMedia: socialMediaSettings,
    });

    try {
      await em.persistAndFlush(nfcConfig);

      // Populate the media
      await NFCConfigResolver.populateMedia(nfcConfig, em);
    } catch (err) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "Failed to create NFC config",
          },
        ],
      };
    }

    return { results: nfcConfig };
  }

  /**
   * Updates an existing NFC configuration.
   * Requires user authentication via ValidateUser middleware.
   *
   * @param options - The updated NFC configuration data
   * @param id - The ObjectId string of the NFC configuration to update
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigResponse> - The updated NFC configuration or error details
   */
  @ValidateUser()
  @Mutation(() => NFCConfigResponse)
  async updateNFCConfig(
    @Arg("options", () => NFCConfigInput) options: NFCConfigInput,
    @Arg("id", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<NFCConfigResponse> {
    // Check if the NFC config exists
    const nfcConfig = await em.findOne(NFCConfig, { _id: new ObjectId(id) });
    if (!nfcConfig) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "NFC config not found",
          },
        ],
      };
    }

    // Update the NFC config
    try {
      em.assign(nfcConfig, {
        ...options,
      });

      // Save the NFC config
      await em.persistAndFlush(nfcConfig);
    } catch (err) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "Failed to update NFC config",
          },
        ],
      };
    }

    return { results: nfcConfig };
  }

  /**
   * Deletes an NFC configuration and its associated media.
   * Requires user authentication via ValidateUser middleware.
   * Also removes any associated media files from the database.
   *
   * @param id - The ObjectId string of the NFC configuration to delete
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigResponse> - The deleted NFC configuration or error details
   */
  @ValidateUser()
  @Mutation(() => NFCConfigResponse)
  async deleteNFCConfig(@Arg("id") id: string, @Ctx() { em }: MyContext) {
    const nfcConfig = await em.findOne(NFCConfig, { _id: new ObjectId(id) });

    // Check if the NFC config exists
    if (!nfcConfig) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "NFC config not found",
          },
        ],
      };
    }

    // Delete the NFC config
    await em.removeAndFlush(nfcConfig);

    // Delete the media if it exists
    if (nfcConfig.mediaId) {
      const media = await em.findOne(Media, {
        _id: new ObjectId(nfcConfig.mediaId),
      });
      if (media) {
        await em.removeAndFlush(media);
      }
    }

    return { results: nfcConfig };
  }
}
