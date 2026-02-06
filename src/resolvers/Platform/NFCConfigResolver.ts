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
import { NFCConfig, TileConfigInput } from "../../entities/NFCConfig";
import { MyContext } from "../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";

/**
 * Input type for creating or updating NFC configuration
 */
@InputType()
class NFCConfigInput {
  /** iPhone-style home screen tiles configuration */
  @Field(() => [TileConfigInput], { nullable: true })
  tiles?: TileConfigInput[];

  /** Wallpaper/background for the home screen */
  @Field(() => String, { nullable: true })
  wallpaper?: string;

  /** Array of NFC IDs associated with this configuration */
  @Field(() => [String], { nullable: true })
  nfcIds?: string[];
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
   * Retrieves a single NFC configuration by ID.
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

    const nfcConfig = em.create(NFCConfig, {
      ...options,
      owner: user,
      nfcIds: options.nfcIds || [],
    });

    try {
      await em.persistAndFlush(nfcConfig);
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
   * Deletes an NFC configuration.
   * Requires user authentication via ValidateUser middleware.
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

    return { results: nfcConfig };
  }

  /**
   * Updates only the tiles layout for an NFC configuration.
   * Optimized for the home screen editor.
   *
   * @param id - The ObjectId string of the NFC configuration to update
   * @param tiles - The new tiles configuration
   * @param wallpaper - Optional wallpaper setting
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigResponse> - The updated NFC configuration or error details
   */
  @ValidateUser()
  @Mutation(() => NFCConfigResponse)
  async updateNFCTiles(
    @Arg("id", () => String) id: string,
    @Arg("tiles", () => [TileConfigInput]) tiles: TileConfigInput[],
    @Arg("wallpaper", () => String, { nullable: true }) wallpaper: string | null,
    @Ctx() { em }: MyContext
  ): Promise<NFCConfigResponse> {
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

    try {
      nfcConfig.tiles = tiles;
      if (wallpaper !== null) {
        nfcConfig.wallpaper = wallpaper;
      }
      
      await em.persistAndFlush(nfcConfig);
    } catch (err) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "Failed to update tiles",
          },
        ],
      };
    }

    return { results: nfcConfig };
  }
}
