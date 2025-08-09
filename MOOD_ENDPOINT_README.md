# Mood-Based Verse Endpoint

This document describes the new mood-based verse endpoint that provides AI-generated biblical encouragement based on user emotions.

## Overview

The mood endpoint uses OpenAI's GPT-4 to generate personalized biblical responses based on a user's current emotional state. It provides both a relevant Bible verse and an encouraging reflection tailored to the specified mood.

## GraphQL Queries

### Get Mood-Based Verse

```graphql
query GetMoodBasedVerse($input: MoodRequestInput!) {
  getMoodBasedVerse(input: $input) {
    errors {
      message
    }
    result {
      verse
      reference
      reflection
      mood
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "mood": "peaceful",
    "additionalContext": "I'm having a stressful day at work",
    "preferredBibleVersion": "NIV"
  }
}
```

**Response:**

```json
{
  "data": {
    "getMoodBasedVerse": {
      "errors": null,
      "result": {
        "verse": "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.",
        "reference": "John 14:27",
        "reflection": "God's peace surpasses all understanding. Even in stressful moments at work, you can find rest in His presence and let His peace guard your heart.",
        "mood": "peaceful"
      }
    }
  }
}
```

### Get Supported Moods

```graphql
query GetSupportedMoods {
  getSupportedMoods
}
```

**Response:**

```json
{
  "data": {
    "getSupportedMoods": [
      "peaceful",
      "grateful",
      "downcast",
      "frustrated",
      "anxious",
      "loved",
      "guilty",
      "hopeful"
    ]
  }
}
```

## Input Types

### MoodRequestInput

| Field                   | Type   | Required | Description                                   |
| ----------------------- | ------ | -------- | --------------------------------------------- |
| `mood`                  | String | Yes      | One of the supported mood types               |
| `additionalContext`     | String | No       | Extra context about the user's situation      |
| `preferredBibleVersion` | String | No       | Preferred Bible translation (defaults to NIV) |

## Response Types

### VerseResponseType

| Field        | Type   | Description                              |
| ------------ | ------ | ---------------------------------------- |
| `verse`      | String | The complete Bible verse text            |
| `reference`  | String | Bible book, chapter, and verse reference |
| `reflection` | String | AI-generated encouraging reflection      |
| `mood`       | String | The mood that was requested              |

### MoodResponse

| Field    | Type              | Description                        |
| -------- | ----------------- | ---------------------------------- |
| `errors` | [FieldError]      | Array of error messages if any     |
| `result` | VerseResponseType | The generated verse and reflection |

## Supported Moods

The endpoint currently supports these emotional states:

1. **peaceful** - For times of seeking calm and tranquility
2. **grateful** - When feeling thankful and appreciative
3. **downcast** - During periods of sadness or discouragement
4. **frustrated** - When dealing with anger or irritation
5. **anxious** - For moments of worry or stress
6. **loved** - When experiencing or needing affirmation of love
7. **guilty** - During times of remorse or need for forgiveness
8. **hopeful** - When looking forward with optimism

## Frontend Integration

To integrate with your React component, you can use Apollo Client:

```typescript
import { useQuery, useLazyQuery } from "@apollo/client";
import { gql } from "@apollo/client";

const GET_MOOD_VERSE = gql`
  query GetMoodBasedVerse($input: MoodRequestInput!) {
    getMoodBasedVerse(input: $input) {
      errors {
        message
      }
      result {
        verse
        reference
        reflection
        mood
      }
    }
  }
`;

// In your component
const [getMoodVerse, { loading, data, error }] = useLazyQuery(GET_MOOD_VERSE);

const handleMoodSelect = (mood: string) => {
  getMoodVerse({
    variables: {
      input: {
        mood: mood.toLowerCase(),
        additionalContext: "Optional context here",
        preferredBibleVersion: "NIV",
      },
    },
  });
};
```

## Error Handling

The endpoint returns structured errors in the following cases:

- Invalid mood type
- OpenAI API errors
- JSON parsing failures
- Incomplete AI responses

Always check the `errors` field in the response before using the `result`.

## Requirements

- Valid OpenAI API key in environment variables (`OPENAI_API_KEY`)
- User authentication (endpoint uses `@ValidateUser()` decorator)
- Internet connection for OpenAI API calls

## Notes

- The endpoint uses GPT-4o-mini for cost efficiency
- Temperature is set to 0.7 for varied but consistent responses
- Responses are formatted as JSON and parsed for structured output
- Each request generates a unique response based on the mood and context provided
