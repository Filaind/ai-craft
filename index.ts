import { Agent } from './src/agent'
import OpenAI from "openai";
import { LLMFunctions } from "./src/functions/llm-functions";
import signale from 'signale';
signale.config({
    displayFilename: true,
    displayTimestamp: true,
    displayDate: false,
    underlineLabel: true
});

console.log = signale.info;
console.error = signale.error;
console.warn = signale.warn;
console.debug = signale.debug;
console.info = signale.info;

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.LLM_BASE_URL || "",
});

await LLMFunctions.registerFunctions('./src/functions/examples');


const bot = new Agent({
    host: process.env.SERVER_HOST || 'localhost',
    username: process.env.BOT_USERNAME || 'Bot',
    auth: 'offline',
    port: parseInt(process.env.SERVER_PORT || '25565'),
}, client);