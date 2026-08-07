import crypto from "crypto";

interface IAddTime {
  date: Date;
  typeOfTime: "minutes" | "days";
  time: number;
}

/**
 * Function to add times to a date
 */
export const addTime = ({ date, typeOfTime, time }: IAddTime) => {
  const dateCopy = new Date(date);

  switch (typeOfTime) {
    case "minutes":
      dateCopy.setMinutes(date.getMinutes() + time);
      return dateCopy;
    case "days":
      dateCopy.setDate(date.getDate() + time);
      return dateCopy;
  }
};

/** Escape special regex characters in user-provided search terms. */
export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Escape HTML special characters for safe email template interpolation. */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Function generates an ObjectId from a string
 */
export const generateObjectIdFromString = (string: string) => {
  // Use a hash function to create a deterministic hash from the IP address
  const hash = crypto.createHash("md5").update(string).digest("hex");

  // Extract a portion of the hash to use as the object ID
  const objectId = hash; // Adjust the length as needed

  return objectId;
};

/**
 * Drop keys whose value is `undefined` so MikroORM `em.assign` won't throw
 * on omitted GraphQL input fields.
 */
export const omitUndefined = <T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]?: Exclude<T[K], undefined> } => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as { [K in keyof T]?: Exclude<T[K], undefined> };
};

/**
 * Function to transform underscore keys to camelCase
 */
export const underscoreToCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(underscoreToCamelCase);
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const camelCaseKey = key.replace(/_([a-z])/g, (_, char) =>
        char.toUpperCase()
      );
      acc[camelCaseKey] = underscoreToCamelCase(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};
