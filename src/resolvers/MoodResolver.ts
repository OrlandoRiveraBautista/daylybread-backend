import {
  Resolver,
  Query,
  Arg,
  Ctx,
  InputType,
  Field,
  ObjectType,
} from "type-graphql";
import { MyContext } from "../types";
import { FieldError } from "../entities/Errors/FieldError";
import { ValidateUser } from "../middlewares/userAuth";
import { ChatOpenAI } from "@langchain/openai";
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
      // Validate mood input
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

      // Get user from context and handle authentication
      const req = context.request as any;
      let user: User | undefined;
      if (req.userId) {
        user =
          (await context.em.findOne(User, { _id: new ObjectId(req.userId) })) ??
          undefined;
        if (!user) {
          return { errors: [{ message: "User not found" }] };
        }
      } else {
        return { errors: [{ message: "User authentication required" }] };
      }

      // Clean up expired cache entries for this user
      await this.cleanupExpiredCache(context, user._id.toString());

      // Check for existing valid cache entry
      const moodType = input.mood.toLowerCase() as MoodType;
      const currentTime = new Date();
      const existingCache = await context.em.findOne(MoodCache, {
        userId: user._id.toString(),
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

      // Create a standalone ChatOpenAI instance for mood responses
      const chatModel = new ChatOpenAI({
        temperature: 0.9, // Encourage more variety for verse selection
        modelName: "gpt-4o-mini",
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      // Create mood-specific prompt template
      const moodPrompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are BreadCrumbs, a compassionate AI assistant that provides biblical encouragement based on emotions and feelings. 

          Your task is to provide a thoughtful, biblical response for someone feeling {mood}. 

          You must respond with EXACTLY this JSON format (no additional text or formatting):
          {{
            "verse": "The complete Bible verse text here",
            "reference": "Book Chapter:Verse",
            "reflection": "A personal, encouraging reflection (2-3 sentences) that connects the verse to their current emotional state",
            "mood": "{mood}"
          }}

          Guidelines:
          - Choose a Bible verse that specifically addresses the {mood} emotion
          - Use the exact wording of the {bibleVersion} translation; do not paraphrase the verse text
          - Write the entire response (including the reflection) in the {language} language
          - Use the {bibleVersion} book naming in the reference when applicable
          - Randomize your selection among multiple relevant options; avoid overused verses
          - Do NOT repeat the same verse in consecutive requests
          - The reflection should be personal, warm, and directly speak to someone feeling {mood}
          - Keep the reflection concise but meaningful (2-3 sentences max)
          - Ensure the verse and reflection work together harmoniously
          - The response should feel personalized and encouraging
          
          {additionalContext}
          `
        ),
        HumanMessagePromptTemplate.fromTemplate(
          "I am feeling {mood}. Please provide a Bible verse and encouraging reflection for my current emotional state in the {language} language"
        ),
      ]);

      // Prepare context for the prompt
      const bibleVersion = input.preferredBibleVersion || "NIV";
      const additionalContextText = input.additionalContext
        ? `Additional context to consider: ${input.additionalContext}`
        : "";

      // Generate AI response
      const response = await moodPrompt.pipe(chatModel).invoke({
        mood: input.mood,
        bibleVersion: bibleVersion,
        additionalContext: additionalContextText,
        language: input.language,
      });

      // Parse the AI response
      let aiResponse;
      try {
        // Clean the response content and parse JSON
        const cleanedContent = response.content.toString().trim();
        // Remove any markdown code block formatting if present
        const jsonContent = cleanedContent
          .replace(/```json\n?|\n?```/g, "")
          .trim();
        aiResponse = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error("Failed to parse AI response:", response.content);
        return {
          errors: [
            {
              message:
                "Failed to generate a proper response. Please try again.",
            },
          ],
        };
      }

      // Validate the AI response structure (allow verse to be filled from DB)
      if (!aiResponse.reference || !aiResponse.reflection) {
        return {
          errors: [
            {
              message: "Generated response was incomplete. Please try again.",
            },
          ],
        };
      }

      if (!aiResponse.verse) {
        return {
          errors: [
            {
              message:
                "Could not resolve verse text for the selected reference. Please try again.",
            },
          ],
        };
      }

      // Cache the new response
      const cacheEntry = new MoodCache();
      cacheEntry.userId = user._id.toString();
      cacheEntry.mood = moodType;
      cacheEntry.verse = aiResponse.verse;
      cacheEntry.reference = aiResponse.reference;
      cacheEntry.reflection = aiResponse.reflection;
      cacheEntry.additionalContext = input.additionalContext;
      cacheEntry.preferredBibleVersion = input.preferredBibleVersion;

      // Set expiration time (30 minutes from now)
      const expirationTime = new Date();
      expirationTime.setMinutes(expirationTime.getMinutes() + 30);
      cacheEntry.expiresAt = expirationTime;

      await context.em.persistAndFlush(cacheEntry);

      // Schedule notifications for when cache expires
      try {
        // Get user's notification settings to determine which notifications to schedule
        const userSettings = await context.em.findOne(
          UserNotificationSettings,
          {
            userId: user._id.toString(),
          }
        );

        const notifications: Notification[] = [];

        // Schedule WebSocket notification if enabled (default: enabled)
        if (!userSettings || userSettings.enableWebSocketNotifications) {
          if (!userSettings || userSettings.enableMoodRequestNotifications) {
            const wsNotification = Notification.createMoodRequestNotification(
              user._id.toString(),
              input.mood,
              NotificationDeliveryType.WEBSOCKET,
              expirationTime
            );
            notifications.push(wsNotification);
          }
        }

        // Schedule browser push notification if enabled
        if (
          userSettings &&
          userSettings.enableBrowserPushNotifications &&
          userSettings.enableMoodRequestNotifications &&
          userSettings.pushSubscriptionEndpoint
        ) {
          const pushNotification = Notification.createMoodRequestNotification(
            user._id.toString(),
            input.mood,
            NotificationDeliveryType.BROWSER_PUSH,
            expirationTime
          );
          pushNotification.message = `Your ${input.mood} mood request is ready! Open DailyBread to request a new verse.`;
          notifications.push(pushNotification);
        }

        // Schedule email notification if enabled
        if (
          userSettings &&
          userSettings.enableEmailNotifications &&
          userSettings.enableMoodRequestNotifications
        ) {
          const emailNotification = Notification.createMoodRequestNotification(
            user._id.toString(),
            input.mood,
            NotificationDeliveryType.EMAIL,
            expirationTime
          );
          emailNotification.message = `Your ${input.mood} mood request is ready! Visit DailyBread to request a new verse.`;
          notifications.push(emailNotification);
        }

        if (notifications.length > 0) {
          await context.em.persistAndFlush(notifications);
          console.log(
            `Scheduled ${notifications.length} notifications for mood: ${
              input.mood
            }, user: ${user._id.toString()}`
          );
        }
      } catch (notificationError) {
        console.error("Error scheduling notification:", notificationError);
        // Don't fail the main request if notification scheduling fails
      }

      return {
        result: {
          verse: aiResponse.verse,
          reference: aiResponse.reference,
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
            message: "An unexpected error occurred. Please try again.",
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

  // Get user's mood history
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

  // Check when next mood request is allowed
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

  // Helper method to clean up expired cache entries
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
