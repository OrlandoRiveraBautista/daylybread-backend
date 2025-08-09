import {
  Resolver,
  Query,
  Arg,
  //   Ctx,
  InputType,
  Field,
  ObjectType,
} from "type-graphql";
// import { MyContext } from "../types";
import { FieldError } from "../entities/Errors/FieldError";
import { ValidateUser } from "../middlewares/userAuth";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";

// Input types
@InputType()
export class MoodRequestInput {
  @Field(() => String)
  mood!: string;

  @Field(() => String, { nullable: true })
  additionalContext?: string;

  @Field(() => String, { nullable: true })
  preferredBibleVersion?: string;
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
    @Arg("input") input: MoodRequestInput
    // @Ctx() context: MyContext
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

      // Create a standalone ChatOpenAI instance for mood responses
      const chatModel = new ChatOpenAI({
        temperature: 0.7, // Slightly more creative for varied responses
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
          - Use {bibleVersion} translation when possible, otherwise default to NIV
          - The reflection should be personal, warm, and directly speak to someone feeling {mood}
          - Keep the reflection concise but meaningful (2-3 sentences max)
          - Ensure the verse and reflection work together harmoniously
          - The response should feel personalized and encouraging
          
          {additionalContext}
          `
        ),
        HumanMessagePromptTemplate.fromTemplate(
          "I am feeling {mood}. Please provide a Bible verse and encouraging reflection for my current emotional state."
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

      // Validate the AI response structure
      if (
        !aiResponse.verse ||
        !aiResponse.reference ||
        !aiResponse.reflection
      ) {
        return {
          errors: [
            {
              message: "Generated response was incomplete. Please try again.",
            },
          ],
        };
      }

      return {
        result: {
          verse: aiResponse.verse,
          reference: aiResponse.reference,
          reflection: aiResponse.reflection,
          mood: input.mood,
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
}
