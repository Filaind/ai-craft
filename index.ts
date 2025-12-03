import { Agent } from './src/agent'
import OpenAI from "openai";
import { LLMFunctions } from "./src/functions/llm-functions";
import pino from 'pino';

export const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:mm:ss',
            ignore: 'pid,hostname',
        },
    },
    level: 'debug',
});

console.log = logger.info.bind(logger);
console.error = logger.error.bind(logger);
console.warn = logger.warn.bind(logger);
console.debug = logger.debug.bind(logger);
console.info = logger.info.bind(logger);

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