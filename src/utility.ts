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
      dateCopy.setDate(date.getDate() + 7);
      return dateCopy;
  }
};

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
