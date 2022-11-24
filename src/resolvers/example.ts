import { MyContext } from "src/types";
import { Ctx, Query, Resolver } from "type-graphql";
import { Test } from "../entities/Test";

@Resolver()
export class ExampleResolver {
  @Query(() => String)
  hello() {
    return "Hello World";
  }

  // Get all of the test data
  @Query(() => [Test])
  async getTestData(@Ctx() { em }: MyContext): Promise<Test[]> {
    const s = await em.find(Test, {});
    return s;
  }
}
