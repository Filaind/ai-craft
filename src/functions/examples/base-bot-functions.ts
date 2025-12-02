import type { Bot } from "../../bot"
import { Entity } from "prismarine-entity"
import { LLMFunctions } from "../llm-functions"
import { Movements, goals } from "mineflayer-pathfinder";
import { z } from "zod";

export function getNearbyEntities(bot: Bot, maxDistance = 16) {
    let entity_distances: { entity_id: string, entity: Entity, distance: number }[] = [];
    for (const [entity_id, entity] of Object.entries(bot.mineflayerBot!.entities)) {
        if (entity.username == bot.mineflayerBot!.username) continue;
        const distance = entity.position.distanceTo(bot.mineflayerBot!.entity.position);
        if (distance > maxDistance) continue;
        entity_distances.push({ entity_id, entity: entity, distance: distance });
    }
    entity_distances.sort((a, b) => a.distance - b.distance);
    return entity_distances;
}

LLMFunctions.register({
    name: "walk_to_position",
    description: "Walk to specific absolute coordinates",
    schema: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
    }),
    handler: async (bot: Bot, args) => {
        const promise = new Promise((resolve, reject) => {
            bot.mineflayerBot!.once('goal_reached', () => {
                console.log("Goal reached")
                resolve(true)
            })


            const defaultMove = new Movements(bot.mineflayerBot!)
            bot.mineflayerBot!.pathfinder.setMovements(defaultMove)
            bot.mineflayerBot!.pathfinder.setGoal(new goals.GoalNear(args.x, args.y, args.z, 2))
        })

        await promise

        return {
            message: "Goal reached",
        }
    }
})

LLMFunctions.register({
    name: "walk_to_entity",
    description: "Walk to entity that is specified by entity_id. List of nearby entities can be obtained using get_nearby_entities.",
    schema: z.object({
        entity_id: z.string().describe("Id of the entity to walk to"),
    }),
    handler: async (bot: Bot, args) => {
        const promise = new Promise((resolve, reject) => {
            bot.mineflayerBot!.once('goal_reached', () => {
                console.log("Goal reached")
                resolve(true)
            })

            let entitiy = bot.mineflayerBot!.entities[args.entity_id];
            if (!entitiy) {
                return `Entity with id ${args.entity_id} not found!`;
            }
            let pos = entitiy.position;

            const defaultMove = new Movements(bot.mineflayerBot!)
            bot.mineflayerBot!.pathfinder.setMovements(defaultMove)
            bot.mineflayerBot!.pathfinder.setGoal(new goals.GoalNear(pos.x, pos.y, pos.z, 2))
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
        entity_id: z.string().describe("The id of the entity to attack")
    }),
    handler: async (bot: Bot, args) => {
        let entity = bot.mineflayerBot!.entities[args.entity_id];
        if (!entity) {
            return `Entity with id ${args.entity_id} is not found!`
        }
        bot.mineflayerBot!.pvp.attack(entity)
        return {
            message: `Attacking entity ${args.entity_id}`,
            stop_calling: true
        }
    }
})

LLMFunctions.register({
    name: "get_nearby_entities",
    description: "Get the nearby entities",
    schema: z.object({
        max_distance: z.number().describe("The maximum distance to search for entities. Use 1000 for unlimited distance.")
    }),
    handler: async (bot: Bot, args) => {
        return {
            message: getNearbyEntities(bot, args.max_distance).map(({entity_id, entity, distance}) => ({
                distance,
                entity_id,
                name: entity.name,
                ...(entity.username && { username: entity.username })
            }))
        }
    }
})

LLMFunctions.register({
    name: "set_todo_list",
    description: "Set the todo list",
    schema: z.object({
        todo_list: z.string().describe("Write detailed description of the todo list. Use markdown format")
    }),
    handler: async (bot: Bot, args) => {
        bot.todoList = args.todo_list

        return {
            message: "Todo list set"
        }
    }
})

