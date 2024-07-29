import "reflect-metadata";
import fastify, { FastifyInstance } from "fastify";
import { ApolloServer } from "apollo-server-fastify";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault,
} from "apollo-server-core";
import { ApolloServerPlugin } from "apollo-server-plugin-base";
import cookie from "@fastify/cookie";
import { buildSchema, NonEmptyArray } from "type-graphql";
import { PubSub } from "graphql-subscriptions"; // have to use the graphql-subscriptions directly to
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { MikroORM } from "@mikro-orm/core";
import { MongoDriver } from "@mikro-orm/mongodb";
import { OpenAI } from "langchain/llms/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { ConversationChain } from "langchain/chains";
import { BufferWindowMemory } from "langchain/memory";
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
    mikroOrmConfig: Parameters<typeof MikroORM.init<MongoDriver>>[0];
    resolvers: NonEmptyArray<Function> | NonEmptyArray<string>;
  }) {
    // setting app instance, port number
    this.app = fastify();
    this.port = appInit.port;

    // setting resolvers
    this.resolvers = appInit.resolvers;

    // mikro orm's mongodb configure
    this.mikroConfig = appInit.mikroOrmConfig;
  }

  // function to start app
  public async listen() {
    // PubSub intance for graphql subscriptions
    const pubSub = new PubSub();

    // Schemas
    // mikroORM schema
    const orm = await MikroORM.init<MongoDriver>(this.mikroConfig);
    orm.getSchemaGenerator().createSchema();
    // GraphQL schema
    const graphqlSchema = await buildSchema({
      resolvers: this.resolvers,
      validate: true,
      pubSub, // pubSub instance needs to be added into schema so that graphql knows to look for subscriptions
    });

    // Open AI configuration
    const openai = new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY });
    const chatgpt = new ChatOpenAI({
      temperature: 0,
      streaming: true,
      modelName: "gpt-4o-mini",
    });

    // Chat prompt template
    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "The following is a friendly conversation between a human and an AI (named BreadCrumbs). The AI is talkative and provides lots of specific details from the Bible, using the provided version or defaulting to RVR in Spanish and KJV in English. If the AI does not know the answer to a question, it truthfully says it does not know."
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    // Conversation chain init
    const chain = new ConversationChain({
      memory: new BufferWindowMemory({
        returnMessages: true,
        memoryKey: "history",
        k: 5,
      }),
      prompt: chatPrompt,
      llm: chatgpt,
    });

    const wsServer = new WebSocketServer({
      server: this.app.server,
      path: "/graphql",
    });

    const serverCleanup = useServer(
      {
        schema: graphqlSchema,
      },
      wsServer
    );

    // configure instace of ApolloServer
    this.apolloServer = new ApolloServer({
      schema: graphqlSchema,
      csrfPrevention: true,
      cache: "bounded",
      plugins: [
        this.fastifyAppClosePlugin(this.app),
        ApolloServerPluginDrainHttpServer({ httpServer: this.app.server }),
        ApolloServerPluginLandingPageLocalDefault({ embed: true }),
        {
          async serverWillStart() {
            return {
              async drainServer() {
                await serverCleanup.dispose();
              },
            };
          },
        },
      ],
      context: ({ request, reply }) => ({
        request,
        reply,
        em: orm.em.fork(), // need to use a fork of em
        openai: openai,
        chatgpt: chain,
      }),
    });

    // start ApolloServer
    await this.apolloServer.start();

    // Register ApolloServer to the fastify app
    this.app
      .register(
        this.apolloServer.createHandler({
          // the reason why the cors are added here and not with the @fastify.cors plugin is because
          // that plugin caused overwriting issues
          // this actually worked
          cors: {
            origin: [
              "http://localhost:8100", // ----|
              "http://localhost:3000", // ----------- local
              "https://daylybread-marketr.web.app", // ----- old prod
              "https://daylybread-dev.web.app", // ------ dev
              "https://app.daylybread.com", // ---- prod
            ],
            credentials: true,
          },
        })
      )
      .register(cookie, {
        secret: "my-secret", //should be changed to an actual secret
        parseOptions: {},
      });

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
