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
import { NFCConfig } from "../../entities/NFCConfig";
import { HomeScreen } from "../../entities/HomeScreen";
import { MyContext } from "../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";

// Admin user ID that has access to admin operations
const SUDO_ADMIN_USER_ID = "65239e9380cfeb07c8fb0145";

/**
 * Input type for creating or updating NFC configuration
 */
@InputType()
class NFCConfigInput {
  /** Unique physical tag ID */
  @Field(() => String)
  nfcId!: string;

  /** User-defined name for this device */
  @Field(() => String)
  name!: string;

  /** Type of physical device */
  @Field(() => String, { nullable: true })
  deviceType?: string;

  /** HomeScreen ID to assign to this device */
  @Field(() => String, { nullable: true })
  homeScreenId?: string;
}

/**
 * Input type for admin creating NFC configuration for any user
 */
@InputType()
class AdminNFCConfigInput {
  /** Unique physical tag ID */
  @Field(() => String)
  nfcId!: string;

  /** User-defined name for this device */
  @Field(() => String)
  name!: string;

  /** Type of physical device */
  @Field(() => String, { nullable: true })
  deviceType?: string;

  /** HomeScreen ID to assign to this device */
  @Field(() => String, { nullable: true })
  homeScreenId?: string;

  /** Owner user ID - required for admin creation */
  @Field(() => String)
  ownerId!: string;
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
 * Response type for multiple NFC configurations
 */
@ObjectType()
class NFCConfigsResponse {
  @Field(() => [NFCConfig], { nullable: true })
  results?: NFCConfig[];

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
   * Retrieves all NFC configurations (devices) owned by a user.
   *
   * @param ownerId - The ObjectId string of the user who owns the NFC configurations
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigsResponse> - The NFC configurations or error details
   */
  @Query(() => NFCConfigsResponse)
  async getNFCConfigsByOwner(
    @Arg("ownerId") ownerId: string,
    @Ctx() { em }: MyContext,
  ) {
    const nfcConfigs = await em.find(
      NFCConfig,
      { owner: new ObjectId(ownerId) },
      { populate: ["homeScreen"] },
    );
    return { results: nfcConfigs };
  }

  /**
   * Retrieves an NFC configuration by its physical nfcId.
   *
   * @param nfcId - The unique physical tag ID
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigResponse> - The NFC configuration or error details
   */
  @Query(() => NFCConfigResponse)
  async getNFCConfigByNfcId(
    @Arg("nfcId") nfcId: string,
    @Ctx() { em }: MyContext,
  ) {
    const nfcConfig = await em.findOne(NFCConfig, { nfcId });
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
    @Ctx() { em, request }: MyContext,
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

    // Check if nfcId is already in use
    const existingDevice = await em.findOne(NFCConfig, {
      nfcId: options.nfcId,
    });
    if (existingDevice) {
      return {
        errors: [
          {
            field: "nfcId",
            message: "This NFC device ID is already registered",
          },
        ],
      };
    }

    // Find HomeScreen if provided
    let homeScreen = null;
    if (options.homeScreenId) {
      homeScreen = await em.findOne(HomeScreen, {
        _id: new ObjectId(options.homeScreenId),
      });
      if (!homeScreen) {
        return {
          errors: [
            {
              field: "homeScreenId",
              message: "Home screen not found",
            },
          ],
        };
      }
    }

    const nfcConfig = em.create(NFCConfig, {
      nfcId: options.nfcId,
      name: options.name,
      deviceType: options.deviceType,
      owner: user,
      homeScreen: homeScreen || undefined,
      views: 0,
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
    @Ctx() { em }: MyContext,
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

    // Find HomeScreen if provided
    let homeScreen = null;
    if (options.homeScreenId) {
      homeScreen = await em.findOne(HomeScreen, {
        _id: new ObjectId(options.homeScreenId),
      });
      if (!homeScreen) {
        return {
          errors: [
            {
              field: "homeScreenId",
              message: "Home screen not found",
            },
          ],
        };
      }
    }

    // Update the NFC config
    try {
      em.assign(nfcConfig, {
        name: options.name,
        deviceType: options.deviceType,
        homeScreen: homeScreen || undefined,
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
   * Assigns a HomeScreen to an NFC device.
   *
   * @param id - The ObjectId string of the NFC configuration
   * @param homeScreenId - The HomeScreen ID to assign (null to unassign)
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigResponse> - The updated NFC configuration or error details
   */
  @ValidateUser()
  @Mutation(() => NFCConfigResponse)
  async assignHomeScreenToNFCConfig(
    @Arg("id", () => String) id: string,
    @Arg("homeScreenId", () => String, { nullable: true })
    homeScreenId: string | null,
    @Ctx() { em }: MyContext,
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

    if (homeScreenId) {
      const homeScreen = await em.findOne(HomeScreen, {
        _id: new ObjectId(homeScreenId),
      });
      if (!homeScreen) {
        return {
          errors: [
            {
              field: "HomeScreen",
              message: "Home screen not found",
            },
          ],
        };
      }
      nfcConfig.homeScreen = homeScreen;
    } else {
      // Unassign the device
      nfcConfig.homeScreen = undefined;
    }

    try {
      await em.persistAndFlush(nfcConfig);
    } catch (err) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "Failed to assign home screen to NFC device",
          },
        ],
      };
    }

    return { results: nfcConfig };
  }

  /**
   * Increments the view count for an NFC device (when the physical tag is scanned).
   *
   * @param id - The ObjectId string of the NFC configuration
   * @param em - Database entity manager from GraphQL context
   * @returns Promise<NFCConfigResponse> - The updated NFC configuration or error details
   */
  @Mutation(() => NFCConfigResponse)
  async incrementNFCConfigViews(
    @Arg("id", () => String) id: string,
    @Ctx() { em }: MyContext,
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
      nfcConfig.views += 1;
      nfcConfig.lastScannedAt = new Date();
      await em.persistAndFlush(nfcConfig);
    } catch (err) {
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "Failed to increment views",
          },
        ],
      };
    }

    return { results: nfcConfig };
  }

  /**
   * Admin: Creates a new NFC configuration for any user.
   * Only accessible by sudo admin users.
   *
   * @param options - The NFC configuration data including owner ID
   * @param em - Database entity manager from GraphQL context
   * @param request - HTTP request object containing user authentication data
   * @returns Promise<NFCConfigResponse> - The created NFC configuration or error details
   */
  @ValidateUser()
  @Mutation(() => NFCConfigResponse)
  async adminCreateNFCConfig(
    @Arg("options", () => AdminNFCConfigInput) options: AdminNFCConfigInput,
    @Ctx() { em, request }: MyContext,
  ): Promise<NFCConfigResponse> {
    const req = request as any;

    // Check if user is authenticated
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

    // Check if user is sudo admin
    if (req.userId.toString() !== SUDO_ADMIN_USER_ID) {
      return {
        errors: [
          {
            field: "Authorization",
            message:
              "You do not have permission to create NFC configs for other users.",
          },
        ],
      };
    }

    // Find the owner user
    const owner = await em.findOne(User, {
      _id: new ObjectId(options.ownerId),
    });
    if (!owner) {
      return {
        errors: [
          {
            field: "ownerId",
            message: "Owner user not found.",
          },
        ],
      };
    }

    // Check if nfcId is already in use
    const existingDevice = await em.findOne(NFCConfig, {
      nfcId: options.nfcId,
    });
    if (existingDevice) {
      return {
        errors: [
          {
            field: "nfcId",
            message: "This NFC device ID is already registered",
          },
        ],
      };
    }

    // Find HomeScreen if provided
    let homeScreen = null;
    if (options.homeScreenId) {
      homeScreen = await em.findOne(HomeScreen, {
        _id: new ObjectId(options.homeScreenId),
      });
      if (!homeScreen) {
        return {
          errors: [
            {
              field: "homeScreenId",
              message: "Home screen not found",
            },
          ],
        };
      }
    }

    const nfcConfig = em.create(NFCConfig, {
      nfcId: options.nfcId,
      name: options.name,
      deviceType: options.deviceType,
      owner: owner,
      homeScreen: homeScreen || undefined,
      views: 0,
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
   * Admin: Get all NFC configurations.
   * Only accessible by sudo admin users.
   *
   * @param limit - Maximum number of results to return (default: 50)
   * @param em - Database entity manager from GraphQL context
   * @param request - HTTP request object containing user authentication data
   * @returns Promise<NFCConfigsResponse> - All NFC configurations or error details
   */
  @ValidateUser()
  @Query(() => NFCConfigsResponse)
  async adminGetAllNFCConfigs(
    @Arg("limit", () => Number, { nullable: true }) limit: number = 50,
    @Ctx() { em, request }: MyContext,
  ): Promise<NFCConfigsResponse> {
    const req = request as any;

    // Check if user is authenticated
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

    // Check if user is sudo admin
    if (req.userId.toString() !== SUDO_ADMIN_USER_ID) {
      return {
        errors: [
          {
            field: "Authorization",
            message: "You do not have permission to view all NFC configs.",
          },
        ],
      };
    }

    try {
      const nfcConfigs = await em.find(
        NFCConfig,
        {},
        {
          limit,
          populate: ["owner", "homeScreen"],
          orderBy: { createdAt: "DESC" },
        },
      );
      return { results: nfcConfigs };
    } catch (error) {
      console.error("Error fetching all NFC configs:", error);
      return {
        errors: [
          {
            field: "NFCConfig",
            message: "Failed to fetch NFC configs.",
          },
        ],
      };
    }
  }
}
