import type { Bot } from "../../bot"
import type { Entity } from "prismarine-entity"
import { LLMFunctions } from "../llm-functions"
import { Movements, goals } from "mineflayer-pathfinder";
import { z } from "zod";

export function getNearbyEntities(bot: Bot, maxDistance = 16) {
    let entity_distances: { entity: Entity, distance: number }[] = [];
    let entities = Object.values(bot.mineflayerBot!.entities).filter((v) => v.username != bot.mineflayerBot!.username)
    for (const entity of entities) {
        const distance = entity.position.distanceTo(bot.mineflayerBot!.entity.position);
        if (distance > maxDistance) continue;
        entity_distances.push({ entity: entity, distance: distance });
    }
    entity_distances.sort((a, b) => a.distance - b.distance);
    return entity_distances;
}

LLMFunctions.register({
    name: "walk_to_position",
    description: "Before calling this function, you must call the function 'get nearby entities' to get the position of the entity you want to walk to",
    schema: z.object({
        x: z.number().describe("The x coordinate of the position to walk to"),
        y: z.number().describe("The y coordinate of the position to walk to"),
        z: z.number().describe("The z coordinate of the position to walk to")
    }),
    handler: async (bot: Bot, args) => {
        const promise = new Promise((resolve, reject) => {
            bot.mineflayerBot!.once('goal_reached', () => {
                console.log("Goal reached")
                resolve(true)
            })


            const defaultMove = new Movements(bot.mineflayerBot!)
            bot.mineflayerBot!.pathfinder.setMovements(defaultMove)
            bot.mineflayerBot!.pathfinder.setGoal(new goals.GoalNear(args.x, args.y, args.z, 1))
        })

        await promise

        return {
            message: "Goal reached",
        }
    }
})

LLMFunctions.register({
    name: "attack_entity",
    description: "You can use this function to attack an entity or mobs for farm or other purposes",
    schema: z.object({
        entity_id: z.number().describe("The id of the entity to attack")
    }),
    handler: async (bot: Bot, args) => {
        let entities = getNearbyEntities(bot, 1000).map((entity) => entity.entity);
        entities = entities.filter((entity) => entity!.id === args.entity_id)
        if (entities.length === 0) {
            return "Entity not found"
        }
        bot.mineflayerBot!.pvp.attack(entities[0]!)
        return {
            message: "Attacking entity",
            stop_calling: true
        }
    }
})

LLMFunctions.register({
    name: "get_nearby_entities",
    description: "Get the nearby entities",
    schema: z.object({
        max_distance: z.number().describe("The maximum distance to search for entities")
    }),
    handler: async (bot: Bot, args) => {
        return {
            message: getNearbyEntities(bot, args.max_distance).map(({entity, distance}) => ({
                distance,
                id: entity.id,
                position: entity.position,
                name: entity.name,
                ...(entity.username && { username: entity.username })
            }))
        }
    }
})
