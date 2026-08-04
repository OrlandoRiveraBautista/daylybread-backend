import {
  Resolver,
  Query,
  Arg,
  Ctx,
  InputType,
  Field,
  ObjectType,
} from "type-graphql";
import { z } from "zod";
import { MyContext } from "../types";
import { FieldError } from "../entities/Errors/FieldError";
import { ValidateUser } from "../middlewares/userAuth";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { MoodCache, MoodType } from "../entities/MoodCache";
import { User } from "../entities/User";
import { ObjectId } from "@mikro-orm/mongodb";
import {
  Notification,
  NotificationDeliveryType,
  UserNotificationSettings,
} from "../entities/Notification";
import { AI_CONFIG } from "../misc/ai/config";
import { createChatModel } from "../misc/ai/createChatModel";
import { toSafeAiErrorMessage } from "../misc/ai/errors";
import { timedAiCall } from "../misc/ai/observability";
import {
  assertInputWithinLimit,
  withAiSlot,
} from "../misc/ai/rateLimit";
import { groundVerseText } from "../misc/ai/verseGrounding";

const MoodAiSchema = z.object({
  bookId: z
    .string()
    .describe("USFM-style book id, e.g. JHN, PSA, 1CO"),
  chapter: z.number().int().positive(),
  verseStart: z.number().int().positive(),
  verseEnd: z.number().int().positive().optional(),
  reference: z
    .string()
    .describe("Human-readable reference, e.g. John 3:16"),
  reflection: z
    .string()
    .describe("Personal encouraging reflection in 2-3 sentences"),
  mood: z.string(),
});

// Input types
@InputType()
export class MoodRequestInput {
  @Field(() => String)
  mood!: string;

  @Field(() => String, { nullable: true })
  additionalContext?: string;

  @Field(() => String, { nullable: true })
  preferredBibleVersion?: string;

  @Field(() => String, { nullable: true })
  language?: string;
}

// Output types
@ObjectType()
export class VerseResponseType {
  @Field(() => String)
  verse!: string;

  @Field(() => String)
  reference!: string;

  @Field(() => String)
  reflection!: string;

  @Field(() => String)
  mood!: string;

  @Field(() => Boolean)
  fromCache!: boolean;

  @Field(() => Date, { nullable: true })
  nextRequestAllowed?: Date;
}

@ObjectType()
export class MoodResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => VerseResponseType, { nullable: true })
  result?: VerseResponseType;
}

@Resolver()
export class MoodResolver {
  @ValidateUser()
  @Query(() => MoodResponse)
  async getMoodBasedVerse(
    @Arg("input") input: MoodRequestInput,
    @Ctx() context: MyContext
  ): Promise<MoodResponse> {
    try {
      const validMoods = [
        "peaceful",
        "grateful",
        "downcast",
        "frustrated",
        "anxious",
        "loved",
        "guilty",
        "hopeful",
      ];

      if (!validMoods.includes(input.mood.toLowerCase())) {
        return {
          errors: [
            {
              message: `Invalid mood. Must be one of: ${validMoods.join(", ")}`,
            },
          ],
        };
      }

      const req = context.request as any;
      if (!req.userId) {
        return { errors: [{ message: "User authentication required" }] };
      }

      const user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
      if (!user) {
        return { errors: [{ message: "User not found" }] };
      }

      const userId = user._id.toString();
      assertInputWithinLimit(input.additionalContext, input.mood);

      await this.cleanupExpiredCache(context, userId);

      const moodType = input.mood.toLowerCase() as MoodType;
      const currentTime = new Date();
      const existingCache = await context.em.findOne(MoodCache, {
        userId,
        mood: moodType,
        expiresAt: { $gt: currentTime },
      });

      if (existingCache) {
        return {
          result: {
            verse: existingCache.verse,
            reference: existingCache.reference,
            reflection: existingCache.reflection,
            mood: existingCache.mood,
            fromCache: true,
            nextRequestAllowed: existingCache.expiresAt,
          },
        };
      }

      const bibleVersion = input.preferredBibleVersion || "NIV";
      const language = input.language || "English";
      const additionalContextText = input.additionalContext
        ? `Additional context to consider: ${input.additionalContext}`
        : "";

      const chatModel = createChatModel({
        temperature: AI_CONFIG.temperatures.mood,
        maxTokens: AI_CONFIG.maxTokens.mood,
      });

      const structuredModel = chatModel.withStructuredOutput(MoodAiSchema, {
        name: "mood_verse_response",
      });

      const moodPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are BreadCrumbs, a compassionate AI assistant that provides biblical encouragement based on emotions and feelings.

Your task is to choose a Bible verse reference (not the verse text) and write a reflection for someone feeling {mood}.

Guidelines:
- Choose a Bible verse that specifically addresses the {mood} emotion
- Prefer well-known, accurate canonical references
- Use USFM-style bookId values (JHN, PSA, ROM, 1CO, etc.)
- Write the reflection in the {language} language
- Use {bibleVersion} book naming in the reference when applicable
- Randomize among relevant options; avoid overused verses when possible
- The reflection should be personal, warm, and 2-3 sentences
- Do NOT invent or paraphrase verse text — only return the reference fields and reflection

{additionalContext}`
        ),
        HumanMessagePromptTemplate.fromTemplate(
          "I am feeling {mood}. Provide a Bible verse reference and encouraging reflection in {language}."
        ),
      ]);

      const aiResponse = await withAiSlot(() =>
        timedAiCall(
          {
            feature: "mood",
            userId,
            model: AI_CONFIG.model,
          },
          async () =>
            moodPrompt.pipe(structuredModel).invoke({
              mood: input.mood,
              bibleVersion,
              additionalContext: additionalContextText,
              language,
            })
        )
      );

      if (!aiResponse.reference || !aiResponse.reflection) {
        return {
          errors: [
            {
              message: "Generated response was incomplete. Please try again.",
            },
          ],
        };
      }

      const grounded = await groundVerseText(
        context.em,
        {
          bookId: aiResponse.bookId,
          chapter: aiResponse.chapter,
          verseStart: aiResponse.verseStart,
          verseEnd: aiResponse.verseEnd,
          reference: aiResponse.reference,
        },
        bibleVersion
      );

      if (!grounded?.verseText) {
        return {
          errors: [
            {
              message:
                "Could not resolve verse text for the selected reference. Please try again.",
            },
          ],
        };
      }

      const cacheEntry = new MoodCache();
      cacheEntry.userId = userId;
      cacheEntry.mood = moodType;
      cacheEntry.verse = grounded.verseText;
      cacheEntry.reference = grounded.reference;
      cacheEntry.reflection = aiResponse.reflection;
      cacheEntry.additionalContext = input.additionalContext;
      cacheEntry.preferredBibleVersion = input.preferredBibleVersion;

      const expirationTime = new Date();
      expirationTime.setMinutes(expirationTime.getMinutes() + 30);
      cacheEntry.expiresAt = expirationTime;

      await context.em.persistAndFlush(cacheEntry);

      try {
        const userSettings = await context.em.findOne(
          UserNotificationSettings,
          {
            userId,
          }
        );

        const notifications: Notification[] = [];

        if (!userSettings || userSettings.enableWebSocketNotifications) {
          if (!userSettings || userSettings.enableMoodRequestNotifications) {
            const wsNotification = Notification.createMoodRequestNotification(
              userId,
              input.mood,
              NotificationDeliveryType.WEBSOCKET,
              expirationTime
            );
            notifications.push(wsNotification);
          }
        }

        if (
          userSettings &&
          userSettings.enableBrowserPushNotifications &&
          userSettings.enableMoodRequestNotifications &&
          userSettings.pushSubscriptionEndpoint
        ) {
          const pushNotification = Notification.createMoodRequestNotification(
            userId,
            input.mood,
            NotificationDeliveryType.BROWSER_PUSH,
            expirationTime
          );
          pushNotification.message = `Your ${input.mood} mood request is ready! Open DaylyBread to request a new verse.`;
          notifications.push(pushNotification);
        }

        if (
          userSettings &&
          userSettings.enableEmailNotifications &&
          userSettings.enableMoodRequestNotifications
        ) {
          const emailNotification = Notification.createMoodRequestNotification(
            userId,
            input.mood,
            NotificationDeliveryType.EMAIL,
            expirationTime
          );
          emailNotification.message = `Your ${input.mood} mood request is ready! Visit DaylyBread to request a new verse.`;
          notifications.push(emailNotification);
        }

        if (notifications.length > 0) {
          await context.em.persistAndFlush(notifications);
        }
      } catch (notificationError) {
        console.error("Error scheduling notification:", notificationError);
      }

      return {
        result: {
          verse: grounded.verseText,
          reference: grounded.reference,
          reflection: aiResponse.reflection,
          mood: input.mood,
          fromCache: false,
          nextRequestAllowed: expirationTime,
        },
      };
    } catch (error) {
      console.error("Error in getMoodBasedVerse:", error);
      return {
        errors: [
          {
            message: toSafeAiErrorMessage(error),
          },
        ],
      };
    }
  }

  @Query(() => [String])
  async getSupportedMoods(): Promise<string[]> {
    return [
      "peaceful",
      "grateful",
      "downcast",
      "frustrated",
      "anxious",
      "loved",
      "guilty",
      "hopeful",
    ];
  }

  @ValidateUser()
  @Query(() => [MoodCache])
  async getUserMoodHistory(@Ctx() context: MyContext): Promise<MoodCache[]> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return [];
      }

      const user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
      if (!user) {
        return [];
      }

      return await context.em.find(
        MoodCache,
        { userId: user._id.toString() },
        { orderBy: { createdAt: -1 }, limit: 20 }
      );
    } catch (error) {
      console.error("Error getting mood history:", error);
      return [];
    }
  }

  @ValidateUser()
  @Query(() => Date, { nullable: true })
  async getNextMoodRequestTime(
    @Arg("mood") mood: string,
    @Ctx() context: MyContext
  ): Promise<Date | null> {
    try {
      const req = context.request as any;
      if (!req.userId) {
        return null;
      }

      const user =
        (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
        undefined;
      if (!user) {
        return null;
      }

      const moodType = mood.toLowerCase() as MoodType;
      const existingCache = await context.em.findOne(MoodCache, {
        userId: user._id.toString(),
        mood: moodType,
        expiresAt: { $gt: new Date() },
      });

      return existingCache?.expiresAt || null;
    } catch (error) {
      console.error("Error getting next mood request time:", error);
      return null;
    }
  }

  private async cleanupExpiredCache(
    context: MyContext,
    userId: string
  ): Promise<void> {
    try {
      const now = new Date();
      await context.em.nativeDelete(MoodCache, {
        userId: userId,
        expiresAt: { $lt: now },
      });
    } catch (error) {
      console.error("Error cleaning up expired cache:", error);
    }
  }
}
