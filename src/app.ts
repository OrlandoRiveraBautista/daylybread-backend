import "reflect-metadata";
import path from "path";
import fastify, { FastifyInstance } from "fastify";
import { ApolloServer } from "apollo-server-fastify";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault,
} from "apollo-server-core";
import { ApolloServerPlugin } from "apollo-server-plugin-base";
import { buildSchema, NonEmptyArray } from "type-graphql";
import {
  EntityClass,
  AnyEntity,
  EntityClassGroup,
  EntitySchema,
  MikroORM,
} from "@mikro-orm/core";
import { MongoDriver } from "@mikro-orm/mongodb";
import { __prod__ } from "./constants";

/** App class */
class App {
  // some variables
  public app: FastifyInstance;
  public port: number;
  public apolloServer: ApolloServer;
  public mikroConfig: Parameters<typeof MikroORM.init<MongoDriver>>[0];
  public resolvers: NonEmptyArray<Function> | NonEmptyArray<string>;

  constructor(appInit: {
    port: number;
    entities:
      | (
          | string
          | EntityClass<AnyEntity<any>>
          | EntityClassGroup<AnyEntity<any>>
          | EntitySchema<any, undefined>
        )[]
      | undefined;
    resolvers: NonEmptyArray<Function> | NonEmptyArray<string>;
  }) {
    // setting app instance, port number
    this.app = fastify();
    this.port = appInit.port;

    // setting resolvers
    this.resolvers = appInit.resolvers

    // mikro orm's mongodb configure
    this.mikroConfig = {
      migrations: {
        path: path.join(__dirname, "./migrations"), // path to the folder with migrations
        // pattern: /^[\w-]+\d+\.[tj]s$/, // this was causing error idk why
      },
      entities: appInit.entities,
      type: "mongo",
      dbName: "daylybread",
      clientUrl: process.env.MONGODBCLIENTURL,
      debug: true,
      implicitTransactions: true,
    } 
  }

  // function to start app
  public async listen() {
    // create schema
    const orm = await MikroORM.init<MongoDriver>(this.mikroConfig);
    orm.getSchemaGenerator().createSchema();

    // configure instace of ApolloServer
    this.apolloServer = new ApolloServer({
      schema: await buildSchema({
        resolvers: this.resolvers,
        validate: true,
      }),
      csrfPrevention: true,
      cache: "bounded",
      plugins: [
        this.fastifyAppClosePlugin(this.app),
        ApolloServerPluginDrainHttpServer({ httpServer: this.app.server }),
        ApolloServerPluginLandingPageLocalDefault({ embed: true }),
      ],
      context: () => ({ em: orm.em.fork() }), // need to use a fork of em
    });

    // start ApolloServer
    await this.apolloServer.start();

    // Register ApolloServer to the fastify app
    this.app.register(this.apolloServer.createHandler());

    // try to initiate app
    try {
      await this.app.listen({ port: this.port });
      console.log(
        `🚀 Server ready at http://localhost:${this.port}${this.apolloServer.graphqlPath}`
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  // plugin options for fastify to handle ApolloServer
  private fastifyAppClosePlugin(app: FastifyInstance): ApolloServerPlugin {
    return {
      async serverWillStart() {
        return {
          async drainServer() {
            await app.close();
          },
        };
      },
    };
  }
}

export default App;
