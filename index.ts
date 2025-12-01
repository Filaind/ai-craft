import { Bot } from './src/bot'
import OpenAI from "openai";
import { LLMFunctions } from "./src/functions/llm-functions";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: "http://192.168.1.204:1234/v1",
});

await LLMFunctions.registerAllFunctions();


const bot = new Bot({
    host: 'localhost',
    username: 'Bot',
    auth: 'offline',
    port: 25565,
}, client);