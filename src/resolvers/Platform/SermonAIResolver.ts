import {
  Resolver,
  Mutation,
  Query,
  Arg,
  Ctx,
  InputType,
  Field,
  ObjectType,
  registerEnumType,
  Subscription,
  Root,
  PubSub,
  PubSubEngine,
} from "type-graphql";
import { MyContext } from "../../types";
import { FieldError } from "../../entities/Errors/FieldError";
import { ValidateUser } from "../../middlewares/userAuth";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { User } from "../../entities/User";
import { ObjectId } from "@mikro-orm/mongodb";

/**
 * Enum for predefined AI assistance categories
 * Note: Values must match keys for GraphQL compatibility
 */
export enum SermonAIPromptType {
  // Structure prompts
  OPENING_STORY = "OPENING_STORY",
  MAIN_POINTS = "MAIN_POINTS",
  CALL_TO_ACTION = "CALL_TO_ACTION",
  TRANSITIONS = "TRANSITIONS",
  SERMON_OUTLINE = "SERMON_OUTLINE",

  // Scripture prompts
  RELEVANT_VERSES = "RELEVANT_VERSES",
  HISTORICAL_CONTEXT = "HISTORICAL_CONTEXT",
  CROSS_REFERENCES = "CROSS_REFERENCES",
  TESTAMENT_CONNECTION = "TESTAMENT_CONNECTION",
  VERSE_EXPLANATION = "VERSE_EXPLANATION",

  // Illustration prompts
  PERSONAL_TESTIMONY = "PERSONAL_TESTIMONY",
  MODERN_EXAMPLE = "MODERN_EXAMPLE",
  DAILY_LIFE_ANALOGY = "DAILY_LIFE_ANALOGY",
  CURRENT_EVENTS = "CURRENT_EVENTS",

  // Application prompts
  PRACTICAL_APPLICATION = "PRACTICAL_APPLICATION",
  ADDRESS_CHALLENGES = "ADDRESS_CHALLENGES",
  ACTIONABLE_STEPS = "ACTIONABLE_STEPS",
  REFLECTION_QUESTIONS = "REFLECTION_QUESTIONS",

  // General prompts
  EXPAND_CONTENT = "EXPAND_CONTENT",
  SUMMARIZE = "SUMMARIZE",
  IMPROVE_CLARITY = "IMPROVE_CLARITY",
  ADD_DEPTH = "ADD_DEPTH",
  CUSTOM = "CUSTOM",
}

registerEnumType(SermonAIPromptType, {
  name: "SermonAIPromptType",
  description: "Types of AI assistance available for sermon writing",
});

/**
 * Input type for sermon AI assistance requests
 */
@InputType()
export class SermonAIInput {
  @Field(() => SermonAIPromptType)
  promptType!: SermonAIPromptType;

  @Field(() => String, { nullable: true })
  customPrompt?: string; // For custom prompts or additional context

  @Field(() => String, { nullable: true })
  sermonTitle?: string; // Current sermon title for context

  @Field(() => String, { nullable: true })
  sermonContent?: string; // Current sermon content for context

  @Field(() => String, { nullable: true })
  highlightedText?: string; // Selected/highlighted text to work with

  @Field(() => String, { nullable: true })
  additionalContext?: string; // Any additional context (scripture reference, topic, etc.)

  @Field(() => String, { nullable: true })
  language?: string; // Preferred language for response

  @Field(() => String, { nullable: true })
  sessionId?: string; // Session ID for streaming (required for streaming endpoint)
}

/**
 * Output type for AI-generated content
 */
@ObjectType()
export class SermonAIContent {
  @Field(() => String)
  content!: string; // The main generated content

  @Field(() => String, { nullable: true })
  suggestions?: string; // Additional suggestions or notes

  @Field(() => [String], { nullable: true })
  relatedVerses?: string[]; // Related Bible verses if applicable

  @Field(() => String)
  promptType!: string; // Echo back the prompt type used
}

/**
 * Response type for sermon AI operations
 */
@ObjectType()
export class SermonAIResponse {
  @Field(() => SermonAIContent, { nullable: true })
  result?: SermonAIContent;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

/**
 * Prompt templates for different assistance types
 */
const PROMPT_TEMPLATES: Record<SermonAIPromptType, { system: string; human: string }> = {
  // Structure prompts
  [SermonAIPromptType.OPENING_STORY]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to help create an engaging opening story for a sermon.
    
    Guidelines:
    - Create a compelling narrative hook that draws listeners in
    - Keep it concise (2-3 paragraphs)
    - Ensure it relates to the sermon's theme
    - Make it relatable to everyday life
    - Include emotional elements that connect with the audience`,
    human: `Create an engaging opening story for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.MAIN_POINTS]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to develop clear main points for a sermon.
    
    Guidelines:
    - Develop 3-4 distinct main points
    - Each point should be memorable and clearly stated
    - Include supporting sub-points for each
    - Ensure logical flow between points
    - Connect each point back to the central theme`,
    human: `Develop main points for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.CALL_TO_ACTION]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to craft a powerful call to action.
    
    Guidelines:
    - Make it specific and actionable
    - Create urgency without manipulation
    - Offer multiple levels of commitment
    - Connect it to the sermon's message
    - Make it memorable and inspiring`,
    human: `Create a compelling call to action for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.TRANSITIONS]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to create smooth transitions between sermon sections.
    
    Guidelines:
    - Create natural bridges between ideas
    - Summarize previous point while introducing next
    - Use transitional phrases effectively
    - Maintain flow and engagement
    - Keep transitions concise but meaningful`,
    human: `Create smooth transitions for a sermon about: {context}
    
    Current content:
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.SERMON_OUTLINE]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to create a comprehensive sermon outline.
    
    Guidelines:
    - Include introduction, main body, and conclusion
    - Provide 3-4 main points with sub-points
    - Suggest scripture references for each section
    - Include timing estimates
    - Add notes for illustrations and applications`,
    human: `Create a complete sermon outline for: {context}
    
    {highlightedText}
    {additionalContext}`,
  },

  // Scripture prompts
  [SermonAIPromptType.RELEVANT_VERSES]: {
    system: `You are BreadCrumbs, a Bible scholar assistant. Your task is to suggest relevant Bible verses.
    
    Guidelines:
    - Suggest 5-10 highly relevant verses
    - Include both Old and New Testament options
    - Provide brief explanations for each
    - Consider various Bible themes
    - Include verse text and reference`,
    human: `Suggest relevant Bible verses for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.HISTORICAL_CONTEXT]: {
    system: `You are BreadCrumbs, a Bible scholar assistant. Your task is to provide historical and cultural context.
    
    Guidelines:
    - Explain the historical setting
    - Describe cultural practices of the time
    - Identify the original audience
    - Clarify any customs or traditions
    - Connect historical context to modern understanding`,
    human: `Provide historical context for: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.CROSS_REFERENCES]: {
    system: `You are BreadCrumbs, a Bible scholar assistant. Your task is to find cross-references and related passages.
    
    Guidelines:
    - Find parallel passages
    - Identify related themes across books
    - Show how concepts develop throughout Scripture
    - Include both direct quotes and thematic connections
    - Explain the significance of each reference`,
    human: `Find cross-references for: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.TESTAMENT_CONNECTION]: {
    system: `You are BreadCrumbs, a Bible scholar assistant. Your task is to connect Old and New Testament passages.
    
    Guidelines:
    - Show prophecy and fulfillment connections
    - Identify typological relationships
    - Explain how themes develop across testaments
    - Connect covenantal progressions
    - Highlight Christ-centered interpretations`,
    human: `Connect Old and New Testament themes for: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.VERSE_EXPLANATION]: {
    system: `You are BreadCrumbs, a Bible scholar assistant. Your task is to provide in-depth verse explanation.
    
    Guidelines:
    - Break down the verse word by word when helpful
    - Explain key Greek/Hebrew terms
    - Provide multiple interpretation perspectives
    - Connect to broader biblical theology
    - Make it accessible for sermon delivery`,
    human: `Explain this verse/passage in depth: {context}
    
    {highlightedText}
    {additionalContext}`,
  },

  // Illustration prompts
  [SermonAIPromptType.PERSONAL_TESTIMONY]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to suggest a framework for a personal testimony.
    
    Guidelines:
    - Create a testimony outline/framework
    - Suggest emotional beats to hit
    - Provide prompts for personal reflection
    - Structure: Before, During, After transformation
    - Keep it relatable and authentic`,
    human: `Create a personal testimony framework for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.MODERN_EXAMPLE]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to provide modern examples and illustrations.
    
    Guidelines:
    - Create relevant modern-day scenarios
    - Use culturally appropriate examples
    - Include both positive and cautionary examples
    - Make examples specific and vivid
    - Ensure theological accuracy`,
    human: `Provide modern examples for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.DAILY_LIFE_ANALOGY]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to create analogies from daily life.
    
    Guidelines:
    - Use common experiences everyone can relate to
    - Create vivid, memorable analogies
    - Ensure theological accuracy
    - Include sensory details
    - Bridge the abstract to concrete`,
    human: `Create daily life analogies for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.CURRENT_EVENTS]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to connect sermon themes to current events.
    
    Guidelines:
    - Reference well-known current topics sensitively
    - Avoid political divisiveness
    - Focus on human interest angles
    - Connect events to biblical principles
    - Maintain timeless truth while being timely`,
    human: `Connect to current events for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },

  // Application prompts
  [SermonAIPromptType.PRACTICAL_APPLICATION]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to create practical applications.
    
    Guidelines:
    - Make applications specific and actionable
    - Include applications for different life stages
    - Address various life contexts (work, home, church)
    - Provide both individual and corporate applications
    - Balance challenge with encouragement`,
    human: `Create practical applications for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.ADDRESS_CHALLENGES]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to address common challenges and objections.
    
    Guidelines:
    - Anticipate common objections or difficulties
    - Provide compassionate responses
    - Include biblical support for each response
    - Acknowledge real struggles honestly
    - Offer hope and solutions`,
    human: `Address challenges and objections for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.ACTIONABLE_STEPS]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to create actionable steps.
    
    Guidelines:
    - Create 3-5 specific action steps
    - Make them measurable when possible
    - Include immediate and long-term actions
    - Provide accountability suggestions
    - Connect each step to biblical principles`,
    human: `Create actionable steps for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.REFLECTION_QUESTIONS]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to create reflection questions.
    
    Guidelines:
    - Create thought-provoking questions
    - Include personal and group discussion questions
    - Progress from surface to deep reflection
    - Connect to the sermon's main points
    - Encourage honest self-examination`,
    human: `Create reflection questions for a sermon about: {context}
    
    {highlightedText}
    {additionalContext}`,
  },

  // General prompts
  [SermonAIPromptType.EXPAND_CONTENT]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to expand and develop content.
    
    Guidelines:
    - Add depth and detail to existing content
    - Include supporting examples and illustrations
    - Maintain the original voice and style
    - Add biblical support where appropriate
    - Keep expansions focused and relevant`,
    human: `Expand and develop this sermon content: {context}
    
    Content to expand:
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.SUMMARIZE]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to summarize content clearly.
    
    Guidelines:
    - Capture the essential message
    - Maintain key points and themes
    - Create concise, memorable summaries
    - Preserve the emotional impact
    - Suitable for review or recap`,
    human: `Summarize this sermon content: {context}
    
    Content to summarize:
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.IMPROVE_CLARITY]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to improve clarity and readability.
    
    Guidelines:
    - Simplify complex sentences
    - Improve logical flow
    - Use active voice
    - Eliminate jargon unless necessary
    - Maintain theological accuracy`,
    human: `Improve the clarity of this sermon content: {context}
    
    Content to improve:
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.ADD_DEPTH]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant. Your task is to add theological and spiritual depth.
    
    Guidelines:
    - Deepen theological insights
    - Add layers of meaning
    - Connect to broader biblical themes
    - Include scholarly perspectives when helpful
    - Maintain accessibility`,
    human: `Add depth to this sermon content: {context}
    
    Content to enhance:
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.CUSTOM]: {
    system: `You are BreadCrumbs, an expert sermon writing assistant and Bible scholar. You help pastors and ministry leaders create powerful, biblically-grounded sermons.
    
    Guidelines:
    - Always maintain biblical accuracy
    - Provide practical, actionable content
    - Be encouraging but truthful
    - Use clear, accessible language
    - Include relevant scripture references`,
    human: `{customPrompt}
    
    Sermon context: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
};

@Resolver()
export class SermonAIResolver {
  /**
   * Generate AI-assisted content for sermon writing
   */
  @ValidateUser()
  @Mutation(() => SermonAIResponse)
  async generateSermonContent(
    @Arg("input") input: SermonAIInput,
    @Ctx() context: MyContext
  ): Promise<SermonAIResponse> {
    try {
      // Validate user authentication
      const req = context.request as any;
      if (!req.userId) {
        return { errors: [{ message: "User authentication required" }] };
      }

      const user = await context.em.findOne(User, { _id: new ObjectId(req.userId) });
      if (!user) {
        return { errors: [{ message: "User not found" }] };
      }

      // Validate custom prompt if using CUSTOM type
      if (input.promptType === SermonAIPromptType.CUSTOM && !input.customPrompt) {
        return { errors: [{ message: "Custom prompt is required for CUSTOM prompt type" }] };
      }

      // Create ChatOpenAI instance
      const chatModel = new ChatOpenAI({
        temperature: 0.7,
        modelName: "gpt-4o-mini",
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      // Get the appropriate prompt template
      const template = PROMPT_TEMPLATES[input.promptType];

      // Build the prompt
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(template.system),
        HumanMessagePromptTemplate.fromTemplate(template.human),
      ]);

      // Prepare context variables
      const contextText = input.sermonTitle
        ? `"${input.sermonTitle}"${input.sermonContent ? `\n\nCurrent content:\n${input.sermonContent.substring(0, 2000)}` : ""}`
        : input.customPrompt || "General sermon assistance";

      const highlightedTextSection = input.highlightedText
        ? `\n\nHighlighted/Selected text to work with:\n"${input.highlightedText}"`
        : "";

      const additionalContextSection = input.additionalContext
        ? `\n\nAdditional context: ${input.additionalContext}`
        : "";

      const languageInstruction = input.language
        ? `\n\nPlease respond in ${input.language}.`
        : "";

      // Generate AI response
      const response = await prompt.pipe(chatModel).invoke({
        context: contextText,
        highlightedText: highlightedTextSection,
        additionalContext: additionalContextSection + languageInstruction,
        customPrompt: input.customPrompt || "",
      });

      const responseContent = response.content.toString();

      // Extract any Bible verses mentioned (simple pattern matching)
      const versePattern = /(\d?\s?[A-Za-z]+\s+\d+:\d+(?:-\d+)?)/g;
      const verses = responseContent.match(versePattern) || [];
      const uniqueVerses = [...new Set(verses)];

      return {
        result: {
          content: responseContent,
          promptType: input.promptType,
          relatedVerses: uniqueVerses.length > 0 ? uniqueVerses : undefined,
        },
      };
    } catch (error) {
      console.error("Error in generateSermonContent:", error);
      return {
        errors: [{ message: "An unexpected error occurred. Please try again." }],
      };
    }
  }

  /**
   * Get available prompt types and their descriptions
   */
  @Query(() => [SermonAIPromptInfo])
  async getSermonAIPromptTypes(): Promise<SermonAIPromptInfo[]> {
    return [
      // Structure
      { type: SermonAIPromptType.OPENING_STORY, category: "Structure", label: "Opening Story", description: "Create an engaging opening narrative" },
      { type: SermonAIPromptType.MAIN_POINTS, category: "Structure", label: "Main Points", description: "Develop clear main points" },
      { type: SermonAIPromptType.CALL_TO_ACTION, category: "Structure", label: "Call to Action", description: "Craft a powerful conclusion" },
      { type: SermonAIPromptType.TRANSITIONS, category: "Structure", label: "Transitions", description: "Create smooth section transitions" },
      { type: SermonAIPromptType.SERMON_OUTLINE, category: "Structure", label: "Full Outline", description: "Generate complete sermon outline" },

      // Scripture
      { type: SermonAIPromptType.RELEVANT_VERSES, category: "Scripture", label: "Relevant Verses", description: "Find supporting scripture" },
      { type: SermonAIPromptType.HISTORICAL_CONTEXT, category: "Scripture", label: "Historical Context", description: "Understand the background" },
      { type: SermonAIPromptType.CROSS_REFERENCES, category: "Scripture", label: "Cross References", description: "Find related passages" },
      { type: SermonAIPromptType.TESTAMENT_CONNECTION, category: "Scripture", label: "Testament Connection", description: "Connect OT and NT" },
      { type: SermonAIPromptType.VERSE_EXPLANATION, category: "Scripture", label: "Verse Explanation", description: "Deep dive into a passage" },

      // Illustrations
      { type: SermonAIPromptType.PERSONAL_TESTIMONY, category: "Illustrations", label: "Personal Testimony", description: "Framework for testimonies" },
      { type: SermonAIPromptType.MODERN_EXAMPLE, category: "Illustrations", label: "Modern Example", description: "Contemporary illustrations" },
      { type: SermonAIPromptType.DAILY_LIFE_ANALOGY, category: "Illustrations", label: "Daily Life Analogy", description: "Relatable analogies" },
      { type: SermonAIPromptType.CURRENT_EVENTS, category: "Illustrations", label: "Current Events", description: "Timely connections" },

      // Application
      { type: SermonAIPromptType.PRACTICAL_APPLICATION, category: "Application", label: "Practical Application", description: "Real-world applications" },
      { type: SermonAIPromptType.ADDRESS_CHALLENGES, category: "Application", label: "Address Challenges", description: "Handle objections" },
      { type: SermonAIPromptType.ACTIONABLE_STEPS, category: "Application", label: "Actionable Steps", description: "Specific action items" },
      { type: SermonAIPromptType.REFLECTION_QUESTIONS, category: "Application", label: "Reflection Questions", description: "Discussion questions" },

      // General
      { type: SermonAIPromptType.EXPAND_CONTENT, category: "General", label: "Expand Content", description: "Develop existing content" },
      { type: SermonAIPromptType.SUMMARIZE, category: "General", label: "Summarize", description: "Condense content" },
      { type: SermonAIPromptType.IMPROVE_CLARITY, category: "General", label: "Improve Clarity", description: "Enhance readability" },
      { type: SermonAIPromptType.ADD_DEPTH, category: "General", label: "Add Depth", description: "Deepen theological insight" },
      { type: SermonAIPromptType.CUSTOM, category: "General", label: "Custom Prompt", description: "Your own prompt" },
    ];
  }

  /**
   * Subscription for streaming sermon AI content tokens
   */
  @Subscription(() => String, {
    topics: ({ args }) => `SERMON_AI_STREAM_${args.sessionId}`,
  })
  sermonAIStream(
    @Root() token: string,
    @Arg("sessionId") _sessionId: string
  ): string {
    return token;
  }

  /**
   * Generate AI-assisted content with streaming support
   */
  @ValidateUser()
  @Mutation(() => Boolean)
  async streamSermonContent(
    @Arg("input") input: SermonAIInput,
    @Ctx() context: MyContext,
    @PubSub() pubsub: PubSubEngine
  ): Promise<boolean> {
    try {
      // Validate session ID for streaming
      if (!input.sessionId) {
        await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, "[ERROR] Session ID is required for streaming");
        return false;
      }

      // Validate user authentication
      const req = context.request as any;
      if (!req.userId) {
        await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, "[ERROR] User authentication required");
        return false;
      }

      const user = await context.em.findOne(User, { _id: new ObjectId(req.userId) });
      if (!user) {
        await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, "[ERROR] User not found");
        return false;
      }

      // Validate custom prompt if using CUSTOM type
      if (input.promptType === SermonAIPromptType.CUSTOM && !input.customPrompt) {
        await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, "[ERROR] Custom prompt is required");
        return false;
      }

      // Create ChatOpenAI instance with streaming enabled
      const chatModel = new ChatOpenAI({
        temperature: 0.7,
        modelName: "gpt-4o-mini",
        openAIApiKey: process.env.OPENAI_API_KEY,
        streaming: true,
      });

      // Get the appropriate prompt template
      const template = PROMPT_TEMPLATES[input.promptType];

      // Prepare context variables
      const contextText = input.sermonTitle
        ? `"${input.sermonTitle}"${input.sermonContent ? `\n\nCurrent content:\n${input.sermonContent.substring(0, 2000)}` : ""}`
        : input.customPrompt || "General sermon assistance";

      const highlightedTextSection = input.highlightedText
        ? `\n\nHighlighted/Selected text to work with:\n"${input.highlightedText}"`
        : "";

      const additionalContextSection = input.additionalContext
        ? `\n\nAdditional context: ${input.additionalContext}`
        : "";

      const languageInstruction = input.language
        ? `\n\nPlease respond in ${input.language}.`
        : "";

      // Build the full prompt
      const systemPrompt = template.system;
      const humanPrompt = template.human
        .replace("{context}", contextText)
        .replace("{highlightedText}", highlightedTextSection)
        .replace("{additionalContext}", additionalContextSection + languageInstruction)
        .replace("{customPrompt}", input.customPrompt || "");

      // Collect full content while streaming
      let fullContent = "";
      
      // Stream the response
      await chatModel.invoke(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: humanPrompt },
        ],
        {
          callbacks: [
            {
              async handleLLMNewToken(token: string) {
                fullContent += token;
                await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, token);
              },
            },
          ],
        }
      );

      // Send the full content for final replacement (ensures nothing is missing)
      await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, `[FULL]${fullContent}`);
      
      // Send completion signal
      await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, "[DONE]");

      return true;
    } catch (error) {
      console.error("Error in streamSermonContent:", error);
      await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, "[ERROR] An unexpected error occurred");
      return false;
    }
  }
}

/**
 * Info type for listing available prompt types
 */
@ObjectType()
class SermonAIPromptInfo {
  @Field(() => SermonAIPromptType)
  type!: SermonAIPromptType;

  @Field(() => String)
  category!: string;

  @Field(() => String)
  label!: string;

  @Field(() => String)
  description!: string;
}
