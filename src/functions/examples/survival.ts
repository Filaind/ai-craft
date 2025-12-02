import type { Bot } from "../../bot";
import { LLMFunctions } from "../llm-functions";

import z from "zod"

LLMFunctions.register({
    group: "survival",
    name: "get_hunger_level",
    description: "Returns level of player's hunger",
    schema: z.object({}),
    handler: async (bot: Bot, args) => {
        let level = bot.mineflayerBot!.food;
        return {
            message: `Food saturation is at ${level * 5}%`
        }
    }
})

LLMFunctions.register({
    group: "survival",
    name: "get_health_level",
    description: "Returns level of player's hunger",
    schema: z.object({}),
    handler: async (bot: Bot, args) => {
        let level = bot.mineflayerBot!.health;
        return {
            message: `Health is at ${level * 5}%`
        }
    }
})


