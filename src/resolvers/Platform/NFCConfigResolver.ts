import { Resolver, Query, Arg, Ctx, Mutation } from "type-graphql";
import { NFCConfig } from "../../entities/NFCConfig";
import { MyContext } from "../../types";
import { ObjectId } from "@mikro-orm/mongodb";
@Resolver()
export class NFCConfigResolver {
  @Query(() => NFCConfig)
  async getNFCConfig(@Arg("id") id: string, @Ctx() { em }: MyContext) {
    return await em.findOne(NFCConfig, { _id: new ObjectId(id) });
  }

  @Mutation(() => NFCConfig)
  async createNFCConfig(
    @Arg("nfcConfig") nfcConfig: NFCConfig,
    @Ctx() { em }: MyContext
  ) {
    return await em.persistAndFlush(nfcConfig);
  }

  @Mutation(() => NFCConfig)
  async updateNFCConfig(
    @Arg("nfcConfig") nfcConfig: NFCConfig,
    @Ctx() { em }: MyContext
  ) {
    return await em.persistAndFlush(nfcConfig);
  }

  @Mutation(() => NFCConfig)
  async deleteNFCConfig(@Arg("id") id: string, @Ctx() { em }: MyContext) {
    const nfcConfig = await em.findOne(NFCConfig, { _id: new ObjectId(id) });
    if (!nfcConfig) {
      throw new Error("NFC config not found");
    }
    return await em.removeAndFlush(nfcConfig);
  }
}
