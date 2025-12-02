import type { Bot } from "../../bot"
import type { Entity } from "prismarine-entity"
import { LLMFunctions } from "../llm-functions"
import { Movements, goals } from "mineflayer-pathfinder";
import { z } from "zod";

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
    name: "walk_to_position",
    description: "Before calling this function, you must call the function 'get nearby entities' to get the position of the entity you want to walk to",
    parameters: {
        type: "object",
        properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
        }
    },
    function: async (args: { bot: Bot, x: number, y: number, z: number }) => {

        const promise = new Promise((resolve, reject) => {

            args.bot.mineflayerBot!.once('goal_reached', () => {
                console.log("Goal reached")
                resolve(true)
            })


            const defaultMove = new Movements(args.bot.mineflayerBot!)
            args.bot.mineflayerBot!.pathfinder.setMovements(defaultMove)
            args.bot.mineflayerBot!.pathfinder.setGoal(new goals.GoalNear(args.x, args.y, args.z, 1))
        })

        await promise

        return {
            message: "Goal reached",
        }
    },
    strict: true,
    type: 'function'
})

LLMFunctions.register({
    name: "attack_entity",
    description: "You can use this function to attack an entity or mobs for farm or other purposes",
    parameters: {
        type: "object",
        properties: {
            entity_id: { type: "number", description: "The id of the entity to attack" }
        }
    },
    function: (args: { bot: Bot, entity_id: number }) => {
        let entities = getNearbyEntities(args.bot, 1000)
        entities = entities.filter((entity) => entity!.id === args.entity_id)
        if (entities.length === 0) {
            return "Entity not found"
        }
        args.bot.mineflayerBot!.pvp.attack(entities[0]!)
        return {
            message: "Attacking entity",
            stop_calling: true
        }
    },
    strict: true,
    type: 'function'
})

LLMFunctions.register({
    name: "get_nearby_entities",
    description: "Get the nearby entities",
    schema: z.object({
        maxDistance: z.number().describe("The maximum distance to search for entities")
    }),
    handler: (args) => {
        return getNearbyEntities(args.bot, args.maxDistance)
    }
})

// Хелпер для создания типизированной функции с Zod
function createTypedFunction<T extends z.ZodObject<any>>(
    config: {
        name: string;
        description: string;
        schema: T;
        strict?: boolean;
    },
    handler: (args: { bot: Bot } & z.infer<T>) => any
) {
    const jsonSchema = zodToJsonSchema(config.schema as any, { target: "openAi" });

    LLMFunctions.register({
        name: config.name,
        description: config.description,
        parameters: jsonSchema,
        handler: handler,
        strict: config.strict ?? true,
        type: 'function'
    });
}