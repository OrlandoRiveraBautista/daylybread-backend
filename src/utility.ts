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
