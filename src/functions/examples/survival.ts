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
        return `Food saturation is at ${level} (${level * 5}%)`;
    }
})

LLMFunctions.register({
    group: "survival",
    name: "get_health_level",
    description: "Returns level of player's health",
    schema: z.object({}),
    handler: async (bot: Bot, args) => {
        let level = bot.mineflayerBot!.health;
        return `Health is at ${level} (${level * 5}%)`;
    }
})


