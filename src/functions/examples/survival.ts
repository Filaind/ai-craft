import type { Agent } from "../../agent";
import { LLMFunctions } from "../llm-functions";

import z from "zod"

LLMFunctions.register({
    gameMode: "survival",
    name: "get_hunger_level",
    description: "Returns level of player's hunger",
    schema: z.object({}),
    handler: async (agent: Agent, args) => {
        let level = agent.bot!.food;
        return `Food saturation is at ${level} (${level * 5}%)`;
    }
})

LLMFunctions.register({
    gameMode: "survival",
    name: "get_health_level",
    description: "Returns level of player's health",
    schema: z.object({}),
    handler: async (agent: Agent, args) => {
        let level = agent.bot!.health;
        return `Health is at ${level} (${level * 5}%)`;
    }
})


