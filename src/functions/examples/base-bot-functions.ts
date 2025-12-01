import type { Bot } from "../../bot"
import type { Entity } from "prismarine-entity"
import { LLMFunctions } from "../llm-functions"

export function getNearbyEntities(bot: Bot, maxDistance = 16) {
    let entities: { entity: Entity, distance: number }[] = [];
    for (const entity of Object.values(bot.mineflayerBot!.entities)) {
        const distance = entity.position.distanceTo(bot.mineflayerBot!.entity.position);
        if (distance > maxDistance) continue;
        entities.push({ entity: entity, distance: distance });
    }
    entities.sort((a, b) => a.distance - b.distance);
    let res = [];
    for (let i = 0; i < entities.length; i++) {
        res.push(entities[i]?.entity);
    }
    return res;
}

LLMFunctions.register({
    name: "get nearby entities",
    description: "Get all entities nearby the bot",
    parameters: {
        type: "object",
        properties: {
            maxDistance: { type: "number", description: "The maximum distance to the entity", default: 16 }
        }
    },
    function: (args: { bot: Bot, maxDistance: number }) => {
        return getNearbyEntities(args.bot, args.maxDistance)
    },
    strict: true,
    type: 'function'
})