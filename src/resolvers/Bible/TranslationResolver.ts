import { MyContext } from "src/types";
import { Resolver, Query, Ctx, Arg } from "type-graphql";
import { Translation } from "../../entities/Bible/Translation";

@Resolver()
export class TranslationResolver {
  // Get all of the bible translations
  @Query(() => [Translation])
  async getTranslations(@Ctx() { em }: MyContext): Promise<Translation[]> {
    const s = await em.find(
      Translation,
      {},
      { populate: ["_id", "name", "abbreviation", "lang", "language"] }
    );
    console.log(s);
    return s;
  }

  // Get bible translations by language
  @Query(() => [Translation], { nullable: true })
  async getTranslationByLanguage(
    @Arg("language", () => String) language: string,
    @Ctx() { em }: MyContext
  ): Promise<Translation[]> {
    const results = await em.find(
      Translation,
      { language: language },
      { populate: ["_id", "name", "abbreviation", "lang", "language"] }
    );
    return results;
  }

  // Get bible translations by lang
  @Query(() => [Translation], { nullable: true })
  async getTranslationByLang(
    @Arg("lang", () => String) lang: string,
    @Ctx() { em }: MyContext
  ): Promise<Translation[]> {
    const results = await em.find(
      Translation,
      { lang },
      { populate: ["_id", "name", "abbreviation", "lang", "language"] }
    );
    return results;
  }

  // Get bible translation by name
  @Query(() => Translation, { nullable: true })
  async getTranslationByName(
    @Arg("name", () => String) name: string,
    @Ctx() { em }: MyContext
  ): Promise<Translation | undefined | null> {
    const results = await em.findOne(Translation, { name: name });
    return results;
  }

  // Get bible translation by abbreviation
  @Query(() => Translation, { nullable: true })
  async getTranslationByAbbreviation(
    @Arg("abbreviation", () => String) abbreviation: string,
    @Ctx() { em }: MyContext
  ): Promise<Translation | undefined | null> {
    const results = await em.findOne(Translation, { abbreviation });
    return results;
  }
}
