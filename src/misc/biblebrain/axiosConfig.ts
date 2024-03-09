import dotenv from "dotenv";
import { AxiosRequestConfig } from "axios";

dotenv.config();

const config: AxiosRequestConfig = {
  method: "get",
  maxBodyLength: Infinity,
  headers: { key: process.env.BIBLE_BRAIN_API_KEY, v: 4 },
};

export default config;
