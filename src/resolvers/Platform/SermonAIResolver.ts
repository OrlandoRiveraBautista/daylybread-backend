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

  // Inline editing
  INLINE_EDIT = "INLINE_EDIT",
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
 * Base system instruction to ensure AI stays within Biblical/Christian context
 */
const BASE_SYSTEM_INSTRUCTION = `CRITICAL CONSTRAINT: You must ONLY provide responses related to the Bible, Christianity, Christian theology, and faith. 

You are PROHIBITED from:
- Discussing or promoting other religions, philosophies, or belief systems
- Providing content that contradicts or undermines biblical teaching
- Offering secular advice that is not grounded in Christian principles
- Generating content unrelated to Christian faith and practice

You MUST:
- Ground all responses in Scripture and Christian theology
- Maintain biblical accuracy and orthodoxy
- Focus exclusively on Christian applications and perspectives
- Redirect any off-topic requests back to biblical/Christian context
- If a request cannot be fulfilled within Christian boundaries, politely decline and explain why
- When a sermon title is provided, ensure ALL content directly relates to and supports that specific sermon title and theme
- Keep the sermon title as the central focus and filter all suggestions, illustrations, and applications through its lens
- Make sure every element you generate serves the purpose of the sermon as indicated by its title
- When a language is specified, respond ENTIRELY in that language - do not mix languages or default to English
- Match the linguistic style and cultural context appropriate to the specified language

MARKDOWN FORMATTING REQUIREMENTS (unless otherwise specified):
- Use proper markdown syntax for all formatting
- Use ## for H2 headings, ### for H3 headings when organizing content
- Use **bold** for emphasis on key points or important concepts
- Use *italic* for subtle emphasis or biblical references
- Use bullet lists (-) or numbered lists (1.) for multiple points, steps, or items
- Use > for blockquotes when citing scripture or important quotes
- Separate paragraphs with blank lines
- Use proper markdown list syntax with consistent indentation
- Ensure all markdown syntax is valid and properly formatted

This is non-negotiable for all responses.`;

/**
 * Prompt templates for different assistance types
 */
const PROMPT_TEMPLATES: Record<
  SermonAIPromptType,
  { system: string; human: string }
> = {
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
    - Connect each point back to the central theme
    - Format using markdown: use ## for main point headings, **bold** for emphasis, and bullet points for sub-points`,
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
    - Add notes for illustrations and applications
    - Format using markdown: use ## for major sections, ### for main points, **bold** for emphasis, and bullet points for sub-points`,
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
    - Include verse text and reference
    - Format using markdown: use **bold** for verse references, > blockquotes for verse text, and bullet points for organizing verses`,
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
    - Explain the significance of each reference
    - Format using markdown: use **bold** for verse references, > blockquotes for verse text, and bullet points for organizing references`,
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
    - Balance challenge with encouragement
    - Format using markdown: use ## for application categories, **bold** for key actions, and bullet points for specific applications`,
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
    - Connect each step to biblical principles
    - Format using markdown: use numbered lists (1., 2., 3.) for steps, **bold** for key actions, and bullet points for sub-items`,
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
    - Encourage honest self-examination
    - Format using markdown: use bullet points (-) for questions, **bold** for question categories, and separate sections with ## headings`,
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
    - Keep expansions focused and relevant
    - Preserve any existing markdown formatting and use markdown appropriately for new structured content`,
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
    - Maintain accessibility
    - Format using markdown: use **bold** for key theological concepts, > blockquotes for scripture references, and appropriate headings for organizing insights`,
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
    - Include relevant scripture references
    - Format using markdown: use appropriate headings (##, ###), **bold** for emphasis, bullet points for lists, and > blockquotes for scripture`,
    human: `{customPrompt}
    
    Sermon context: {context}
    
    {highlightedText}
    {additionalContext}`,
  },
  [SermonAIPromptType.INLINE_EDIT]: {
    system: `You are BreadCrumbs, an intelligent inline text editor for sermon writing. Your job is to understand and execute the user's editing instruction on the selected text.

UNDERSTANDING INSTRUCTIONS:
- Carefully analyze what the user wants: rewrite, expand, shorten, rephrase, add to, remove from, clarify, etc.
- If they want you to "add" or "expand" - make the text longer
- If they want you to "shorten" or "condense" - make it briefer
- If they want you to "rewrite" or "rephrase" - keep similar length but change wording
- If they want you to "improve" or "enhance" - maintain the core message but make it better
- If they give specific content to add - integrate it naturally into the text

OUTPUT RULES:
- Output ONLY the replacement text that should replace the selection - NO explanations, NO meta-commentary
- Preserve any markdown formatting that exists in the original text (headings, bold, italic, lists, blockquotes)
- Do NOT add new markdown formatting unless the original text already uses markdown
- CRITICAL: Do NOT wrap your entire response in quotation marks
- Match the tone, style, and sermon voice of the original text
- Adjust length based on what the instruction requires (expansion, reduction, or similar length)
- The output must seamlessly replace the selected text and flow naturally with surrounding content

QUOTING GUIDELINES:
- Use quotation marks ONLY when citing sources within your text:
  * Bible verses: "For God so loved the world..." (John 3:16)
  * Historical figures or theologians: As C.S. Lewis wrote, "..."
  * Direct quotes requiring attribution
- Do NOT wrap your entire output in quotes
- Do NOT add quotes around normal sermon content or narrative text
- Your response should be raw text that directly replaces the selection

FORMATTING:
- Preserve the paragraph structure and flow
- Maintain any existing formatting patterns (like bullet points, if present in original)
- Keep the same narrative voice and perspective`,
    human: `User's editing instruction: {customPrompt}

Selected text to edit:
{highlightedText}

Apply the instruction and provide only the edited replacement text:`,
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
    @Ctx() context: MyContext,
  ): Promise<SermonAIResponse> {
    try {
      // Validate user authentication
      const req = context.request as any;
      if (!req.userId) {
        return { errors: [{ message: "User authentication required" }] };
      }

      const user = await context.em.findOne(User, {
        _id: new ObjectId(req.userId),
      });
      if (!user) {
        return { errors: [{ message: "User not found" }] };
      }

      // Validate custom prompt if using CUSTOM type
      if (
        input.promptType === SermonAIPromptType.CUSTOM &&
        !input.customPrompt
      ) {
        return {
          errors: [
            { message: "Custom prompt is required for CUSTOM prompt type" },
          ],
        };
      }

      // Create ChatOpenAI instance
      const chatModel = new ChatOpenAI({
        temperature: 0.7,
        modelName: "gpt-4o-mini",
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      // Get the appropriate prompt template
      const template = PROMPT_TEMPLATES[input.promptType];

      // Build the prompt with base instruction prepended
      const fullSystemPrompt = `${BASE_SYSTEM_INSTRUCTION}\n\n${template.system}`;
      const prompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(fullSystemPrompt),
        HumanMessagePromptTemplate.fromTemplate(template.human),
      ]);

      // Prepare context variables
      let contextText = "";
      if (input.sermonTitle) {
        contextText = `Sermon Title: "${input.sermonTitle}"`;
        if (input.sermonContent) {
          contextText += `\n\nCurrent sermon content:\n${input.sermonContent.substring(0, 2000)}`;
        }
      } else {
        contextText = input.customPrompt || "General sermon assistance";
      }

      const highlightedTextSection = input.highlightedText
        ? `\n\nHighlighted/Selected text to work with:\n${input.highlightedText}`
        : "";

      const additionalContextSection = input.additionalContext
        ? `\n\nAdditional context: ${input.additionalContext}`
        : "";

      const languageInstruction = input.language
        ? `\n\nCRITICAL: Respond ENTIRELY in ${input.language}. Do not use English or any other language.`
        : "";
      
      const reminderInstruction = input.sermonTitle
        ? `\n\nREMINDER: All content must directly relate to and support the sermon title "${input.sermonTitle}".`
        : "";

      // Generate AI response
      const response = await prompt.pipe(chatModel).invoke({
        context: contextText,
        highlightedText: highlightedTextSection,
        additionalContext: additionalContextSection + languageInstruction + reminderInstruction,
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
        errors: [
          { message: "An unexpected error occurred. Please try again." },
        ],
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
      {
        type: SermonAIPromptType.OPENING_STORY,
        category: "Structure",
        label: "Opening Story",
        description: "Create an engaging opening narrative",
      },
      {
        type: SermonAIPromptType.MAIN_POINTS,
        category: "Structure",
        label: "Main Points",
        description: "Develop clear main points",
      },
      {
        type: SermonAIPromptType.CALL_TO_ACTION,
        category: "Structure",
        label: "Call to Action",
        description: "Craft a powerful conclusion",
      },
      {
        type: SermonAIPromptType.TRANSITIONS,
        category: "Structure",
        label: "Transitions",
        description: "Create smooth section transitions",
      },
      {
        type: SermonAIPromptType.SERMON_OUTLINE,
        category: "Structure",
        label: "Full Outline",
        description: "Generate complete sermon outline",
      },

      // Scripture
      {
        type: SermonAIPromptType.RELEVANT_VERSES,
        category: "Scripture",
        label: "Relevant Verses",
        description: "Find supporting scripture",
      },
      {
        type: SermonAIPromptType.HISTORICAL_CONTEXT,
        category: "Scripture",
        label: "Historical Context",
        description: "Understand the background",
      },
      {
        type: SermonAIPromptType.CROSS_REFERENCES,
        category: "Scripture",
        label: "Cross References",
        description: "Find related passages",
      },
      {
        type: SermonAIPromptType.TESTAMENT_CONNECTION,
        category: "Scripture",
        label: "Testament Connection",
        description: "Connect OT and NT",
      },
      {
        type: SermonAIPromptType.VERSE_EXPLANATION,
        category: "Scripture",
        label: "Verse Explanation",
        description: "Deep dive into a passage",
      },

      // Illustrations
      {
        type: SermonAIPromptType.PERSONAL_TESTIMONY,
        category: "Illustrations",
        label: "Personal Testimony",
        description: "Framework for testimonies",
      },
      {
        type: SermonAIPromptType.MODERN_EXAMPLE,
        category: "Illustrations",
        label: "Modern Example",
        description: "Contemporary illustrations",
      },
      {
        type: SermonAIPromptType.DAILY_LIFE_ANALOGY,
        category: "Illustrations",
        label: "Daily Life Analogy",
        description: "Relatable analogies",
      },
      {
        type: SermonAIPromptType.CURRENT_EVENTS,
        category: "Illustrations",
        label: "Current Events",
        description: "Timely connections",
      },

      // Application
      {
        type: SermonAIPromptType.PRACTICAL_APPLICATION,
        category: "Application",
        label: "Practical Application",
        description: "Real-world applications",
      },
      {
        type: SermonAIPromptType.ADDRESS_CHALLENGES,
        category: "Application",
        label: "Address Challenges",
        description: "Handle objections",
      },
      {
        type: SermonAIPromptType.ACTIONABLE_STEPS,
        category: "Application",
        label: "Actionable Steps",
        description: "Specific action items",
      },
      {
        type: SermonAIPromptType.REFLECTION_QUESTIONS,
        category: "Application",
        label: "Reflection Questions",
        description: "Discussion questions",
      },

      // General
      {
        type: SermonAIPromptType.EXPAND_CONTENT,
        category: "General",
        label: "Expand Content",
        description: "Develop existing content",
      },
      {
        type: SermonAIPromptType.SUMMARIZE,
        category: "General",
        label: "Summarize",
        description: "Condense content",
      },
      {
        type: SermonAIPromptType.IMPROVE_CLARITY,
        category: "General",
        label: "Improve Clarity",
        description: "Enhance readability",
      },
      {
        type: SermonAIPromptType.ADD_DEPTH,
        category: "General",
        label: "Add Depth",
        description: "Deepen theological insight",
      },
      {
        type: SermonAIPromptType.CUSTOM,
        category: "General",
        label: "Custom Prompt",
        description: "Your own prompt",
      },
      {
        type: SermonAIPromptType.INLINE_EDIT,
        category: "Inline",
        label: "Inline Edit",
        description: "Edit selected text directly",
      },
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
    @Arg("sessionId") _sessionId: string,
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
    @PubSub() pubsub: PubSubEngine,
  ): Promise<boolean> {
    try {
      // Validate session ID for streaming
      if (!input.sessionId) {
        await pubsub.publish(
          `SERMON_AI_STREAM_${input.sessionId}`,
          "[ERROR] Session ID is required for streaming",
        );
        return false;
      }

      // Validate user authentication
      const req = context.request as any;
      if (!req.userId) {
        await pubsub.publish(
          `SERMON_AI_STREAM_${input.sessionId}`,
          "[ERROR] User authentication required",
        );
        return false;
      }

      const user = await context.em.findOne(User, {
        _id: new ObjectId(req.userId),
      });
      if (!user) {
        await pubsub.publish(
          `SERMON_AI_STREAM_${input.sessionId}`,
          "[ERROR] User not found",
        );
        return false;
      }

      // Validate custom prompt if using CUSTOM type
      if (
        input.promptType === SermonAIPromptType.CUSTOM &&
        !input.customPrompt
      ) {
        await pubsub.publish(
          `SERMON_AI_STREAM_${input.sessionId}`,
          "[ERROR] Custom prompt is required",
        );
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
      let contextText = "";
      if (input.sermonTitle) {
        contextText = `Sermon Title: "${input.sermonTitle}"`;
        if (input.sermonContent) {
          contextText += `\n\nCurrent sermon content:\n${input.sermonContent.substring(0, 2000)}`;
        }
      } else {
        contextText = input.customPrompt || "General sermon assistance";
      }

      const highlightedTextSection = input.highlightedText
        ? `\n\nHighlighted/Selected text to work with:\n${input.highlightedText}`
        : "";

      const additionalContextSection = input.additionalContext
        ? `\n\nAdditional context: ${input.additionalContext}`
        : "";

      const languageInstruction = input.language
        ? `\n\nCRITICAL: Respond ENTIRELY in ${input.language}. Do not use English or any other language.`
        : "";
      
      const reminderInstruction = input.sermonTitle
        ? `\n\nREMINDER: All content must directly relate to and support the sermon title "${input.sermonTitle}".`
        : "";

      // Build the full prompt with base instruction prepended
      const systemPrompt = `${BASE_SYSTEM_INSTRUCTION}\n\n${template.system}`;
      const humanPrompt = template.human
        .replace("{context}", contextText)
        .replace("{highlightedText}", highlightedTextSection)
        .replace(
          "{additionalContext}",
          additionalContextSection + languageInstruction + reminderInstruction,
        )
        .replace("{customPrompt}", input.customPrompt || "");

      // Collect full content while streaming
      let fullContent = "";

      // Stream the response and capture the final result
      const response = await chatModel.invoke(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: humanPrompt },
        ],
        {
          callbacks: [
            {
              async handleLLMNewToken(token: string) {
                fullContent += token;
                await pubsub.publish(
                  `SERMON_AI_STREAM_${input.sessionId}`,
                  token,
                );
              },
            },
          ],
        },
      );

      // Use the actual response content as the authoritative full text
      // This ensures we get the complete response even if some tokens were missed during streaming
      const actualFullContent = response.content.toString();

      // Send the full content for final replacement (ensures nothing is missing)
      await pubsub.publish(
        `SERMON_AI_STREAM_${input.sessionId}`,
        `[FULL]${actualFullContent}`,
      );

      // Send completion signal
      await pubsub.publish(`SERMON_AI_STREAM_${input.sessionId}`, "[DONE]");

      return true;
    } catch (error) {
      console.error("Error in streamSermonContent:", error);
      await pubsub.publish(
        `SERMON_AI_STREAM_${input.sessionId}`,
        "[ERROR] An unexpected error occurred",
      );
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
