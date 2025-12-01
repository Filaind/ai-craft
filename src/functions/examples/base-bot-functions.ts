import type { Bot } from "../../bot"
import type { Entity } from "prismarine-entity"
import { LLMFunctions } from "../llm-functions"
import { Movements, goals } from "mineflayer-pathfinder";

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
    name: "Walk to position",
    description: "Before calling this function, you must call the function 'get nearby entities' to get the position of the entity you want to walk to",
    parameters: {
        type: "object",
        properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
        }
    },
    function: (args: { bot: Bot, x: number, y: number, z: number }) => {
        const defaultMove = new Movements(args.bot.mineflayerBot!)
        args.bot.mineflayerBot!.pathfinder.setMovements(defaultMove)
        args.bot.mineflayerBot!.pathfinder.setGoal(new goals.GoalNear(args.x, args.y, args.z, 1))

        return "Walking to position. STOP CALLING THIS FUNCTION UNTIL YOU REACH THE POSITION"
    },
    strict: true,
    type: 'function'
})

LLMFunctions.register({
    name: "get nearby entities",
    description: "Get all entities nearby the bot",
    parameters: {
        type: "object",
        properties: {
            type: { type: "string", enum: ["player", "mob"] },
            maxDistance: { type: "number"}
        }
    },
    function: (args: { bot: Bot, type: "player" | "mob", maxDistance: number }) => {
        let entities = getNearbyEntities(args.bot, args.maxDistance)
        if(args.type) {
            entities = entities.filter((entity) => entity!.type === args.type)
        }
        if(entities.length === 0) {
            return "No entities found. Increase the max distance."
        }
        return entities
    },
    strict: true,
    type: 'function'
})