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
import { MyContext } from "../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";

@InputType()
class NFCConfigInput {
  @Field(() => String)
  url!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  description!: string;
}

@ObjectType()
class NFCConfigResponse {
  @Field(() => NFCConfig, { nullable: true })
  results?: NFCConfig;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class NFCConfigResolver {
  @Query(() => NFCConfig)
  async getNFCConfig(@Arg("id") id: string, @Ctx() { em }: MyContext) {
    return await em.findOne(NFCConfig, { _id: new ObjectId(id) });
  }

  @Query(() => NFCConfig)
  async getNFCConfigByOwner(
    @Arg("ownerId") ownerId: string,
    @Ctx() { em }: MyContext
  ) {
    return await em.findOne(NFCConfig, { owner: ownerId });
  }

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
      url: options.url,
      title: options.title,
      description: options.description,
      owner: user,
      nfcIds: [],
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

  @ValidateUser()
  @Mutation(() => NFCConfigResponse)
  async updateNFCConfig(
    @Arg("options", () => NFCConfigInput) options: NFCConfigInput,
    @Arg("id", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<NFCConfigResponse> {
    console.log("Updating NFC config");
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
      em.assign(nfcConfig, options);
      em.persistAndFlush(nfcConfig);
      console.log("NFC config updated");
      console.log(nfcConfig);
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

  @ValidateUser()
  @Mutation(() => NFCConfigResponse)
  async deleteNFCConfig(@Arg("id") id: string, @Ctx() { em }: MyContext) {
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

    await em.removeAndFlush(nfcConfig);

    return { results: nfcConfig };
  }
}
