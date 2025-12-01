import type { Bot } from "../../bot"
import type { Entity } from "prismarine-entity"
import { LLMFunctions } from "../llm-functions"

LLMFunctions.register({
    name: "find nearest entity",
    description: "Find the nearest entity to the bot",
    parameters: {
        type: "object",
        properties: {
            entityType: { type: "string", enum: ['mob', 'player'] },
            name: { type: "string", description: "cow, sheep, etc." }
        }
    },
    function: (args: { bot: Bot, entityType: 'mob' | 'player', name: string }) => {
        let filter = (e: Entity) => e.type === args.entityType
        if (args.name) {
            filter = (e: Entity) => e.type === args.entityType && e.name === args.name
        }
        const entity = args.bot.mineflayerBot!.nearestEntity(filter)
        console.log(entity)
        return {
            entity: entity
        }
    },
    strict: true,
    type: 'function'
})