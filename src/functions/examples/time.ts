import { LLMFunctions } from "../llm-functions";
import type { Bot } from "../../bot";
import z from "zod";

LLMFunctions.register({
    name: "time",
    description: "Get the current time",
    schema: z.object({
        locale: z.string().describe("The JavaScript locale of the time")
    }),
    handler: async (bot: Bot, args) => {
        return {
            message: new Date().toLocaleTimeString(args.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
    }
})
