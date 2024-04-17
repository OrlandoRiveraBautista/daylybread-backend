import App from "./app";
import dotenv from "dotenv";

/* Miroorm config */
import mikroOrmConfig from "./mikro-orm.config";

/* Resolvers */
import { ExampleResolver } from "./resolvers/example";
import { TranslationResolver } from "./resolvers/Bible/TranslationResolver";
import { BookResolver } from "./resolvers/Bible/BookResolver";
import { ChapterResolver } from "./resolvers/Bible/ChapterResolver";
import { VerseResolver } from "./resolvers/Bible/VerseResolver";
import { OpenAiTestResolver } from "./resolvers/OpenAI/test";
import { AuthResolver } from "./resolvers/AuthResolver";
import { UserResolver } from "./resolvers/UserResolver";
import { BookmarkResolver } from "./resolvers/BookmarkResolver";
// Bible Brain Resolvers
import { LanguagesResolver } from "./resolvers/Bible/BibleBrain/LanguagesResolver";
import { BiblesResolver } from "./resolvers/Bible/BibleBrain/BiblesResolver";
import { BooksResolver } from "./resolvers/Bible/BibleBrain/BooksResolver";
import { VersesResolver } from "./resolvers/Bible/BibleBrain/VersesResolver";

dotenv.config();

const server = async () => {
  const app = new App({
    port: process.env.PORT ? Number.parseInt(process.env.PORT) : 5001,
    mikroOrmConfig: mikroOrmConfig,
    resolvers: [
      ExampleResolver,
      AuthResolver,
      LanguagesResolver,
      BiblesResolver,
      BooksResolver,
      VersesResolver,
      TranslationResolver,
      BookResolver,
      ChapterResolver,
      VerseResolver,
      OpenAiTestResolver,
      UserResolver,
      BookmarkResolver,
    ],
  });

  app.listen();
};

server().catch((err) => {
  console.error(err);
});
