# Mood-Based Verse Endpoint with Caching

This document describes the mood-based verse endpoint that provides AI-generated biblical encouragement based on user emotions, with built-in caching to prevent abuse and improve performance.

## Overview

The mood endpoint uses OpenAI's GPT-4 to generate personalized biblical responses based on a user's current emotional state. It provides both a relevant Bible verse and an encouraging reflection tailored to the specified mood. **Each user can only request a new AI-generated response for a specific mood once every 30 minutes**, with cached responses being returned for subsequent requests within that timeframe.

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
        "mood": "peaceful",
        "fromCache": false,
        "nextRequestAllowed": "2024-01-15T15:30:00.000Z"
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

### Get User Mood History

```graphql
query GetUserMoodHistory {
  getUserMoodHistory {
    _id
    mood
    verse
    reference
    reflection
    createdAt
    expiresAt
  }
}
```

### Check Next Request Time

```graphql
query GetNextMoodRequestTime($mood: String!) {
  getNextMoodRequestTime(mood: $mood)
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

| Field                | Type    | Description                                    |
| -------------------- | ------- | ---------------------------------------------- |
| `verse`              | String  | The complete Bible verse text                  |
| `reference`          | String  | Bible book, chapter, and verse reference       |
| `reflection`         | String  | AI-generated encouraging reflection            |
| `mood`               | String  | The mood that was requested                    |
| `fromCache`          | Boolean | Whether this response came from cache          |
| `nextRequestAllowed` | Date    | When the next request for this mood is allowed |

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

## Caching Behavior

### Cache Duration

- **30 minutes**: Time before a user can request a new AI-generated response for the same mood
- Cached responses are returned immediately for subsequent requests within the timeout period
- Each mood has its own independent cache timeout

### Cache Management

- Expired cache entries are automatically cleaned up when new requests are made
- Users can view their mood history with the `getUserMoodHistory` query
- The `getNextMoodRequestTime` query shows when a new request will be allowed for a specific mood

### Cache Storage

- Cached responses include the original request context (additional context, Bible version)
- User-specific caching ensures privacy and personalization
- Database storage using MongoDB with automatic expiration

## Error Handling for Caching

The endpoint returns structured errors in the following cases:

- Invalid mood type
- User not authenticated or not found
- OpenAI API errors (only for new requests)
- JSON parsing failures (only for new requests)
- Incomplete AI responses (only for new requests)

**Note**: Cached responses bypass OpenAI API calls and return immediately, reducing the chance of API-related errors.

## Frontend Integration with Caching

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
        fromCache
        nextRequestAllowed
      }
    }
  }
`;

const GET_NEXT_REQUEST_TIME = gql`
  query GetNextMoodRequestTime($mood: String!) {
    getNextMoodRequestTime(mood: $mood)
  }
`;

// In your component
const [getMoodVerse, { loading, data, error }] = useLazyQuery(GET_MOOD_VERSE);
const [getNextRequestTime] = useLazyQuery(GET_NEXT_REQUEST_TIME);

const handleMoodSelect = async (mood: string) => {
  // Check if user can make a new request
  const nextRequestResult = await getNextRequestTime({
    variables: { mood: mood.toLowerCase() },
  });

  if (nextRequestResult.data?.getNextMoodRequestTime) {
    const nextAllowed = new Date(nextRequestResult.data.getNextMoodRequestTime);
    const now = new Date();
    if (nextAllowed > now) {
      // Show message about when next request is allowed
      const timeRemaining = Math.ceil(
        (nextAllowed.getTime() - now.getTime()) / (1000 * 60)
      );
      alert(
        `Please wait ${timeRemaining} minutes before requesting a new ${mood} verse.`
      );
      return;
    }
  }

  // Make the request
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

// Handle the response
useEffect(() => {
  if (data?.getMoodBasedVerse?.result) {
    const result = data.getMoodBasedVerse.result;
    if (result.fromCache) {
      console.log("Received cached response");
    } else {
      console.log("Received new AI-generated response");
    }

    console.log("Next request allowed at:", result.nextRequestAllowed);
  }
}, [data]);
```

## Notes

- The endpoint uses GPT-4o-mini for cost efficiency
- Temperature is set to 0.7 for varied but consistent responses
- Responses are formatted as JSON and parsed for structured output
- Each request generates a unique response based on the mood and context provided
- **Caching reduces API costs and prevents abuse while maintaining user experience**
- Cache entries are user-specific and mood-specific for optimal personalization
