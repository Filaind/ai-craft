import type { Bot } from "../../bot";
import { LLMFunctions } from "../llm-functions";

import z from "zod";

LLMFunctions.register({
    name: "get_weather",
    description: "Get the current weather",
    schema: z.object({
        city: z.string().describe("The city to get the weather for")
    }),
    handler: async (bot: Bot, args) => {
        return {
            message: {
                temperature: 20,
                humidity: 50,
                pressure: 1013,
                wind_speed: 5,
                wind_direction: "N"
            }
        }
    }
})
