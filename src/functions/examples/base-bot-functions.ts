import type { Agent } from "../../agent"
import { Entity } from "prismarine-entity"
import { LLMFunctions } from "../llm-functions"
import { Movements, goals } from "mineflayer-pathfinder";
import { z } from "zod";

export function getNearbyEntities(agent: Agent, maxDistance = 16) {
    let entity_distances: { entity_id: string, entity: Entity, distance: number }[] = [];
    for (const [entity_id, entity] of Object.entries(agent.mineflayerBot!.entities)) {
        if (entity.username == agent.mineflayerBot!.username) continue;
        const distance = entity.position.distanceTo(agent.mineflayerBot!.entity.position);
        if (distance > maxDistance) continue;
        entity_distances.push({ entity_id, entity: entity as Entity, distance: distance });
    }
    entity_distances.sort((a, b) => a.distance - b.distance);
    return entity_distances;
}

LLMFunctions.register({
    gameMode: "any",
    name: "walk_to_position",
    description: "Walk to specified coordinates",
    schema: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
    }),
    handler: async (agent: Agent, args) => {
        let mbot = agent.mineflayerBot!;
        const defaultMove = new Movements(agent.mineflayerBot!)
        mbot.pathfinder.setMovements(defaultMove)
        
        let goal = new goals.GoalNear(args.x, args.y, args.z, 1);
        await mbot.pathfinder.goto(goal);
        return `Reached to (${args.x}, ${args.y}, ${args.z})`;
    }
})

LLMFunctions.register({
    gameMode: "any",
    name: "walk_to_entity",
    description: "Walk to entity that is specified by entity_id. List of nearby entities can be obtained using get_nearby_entities.",
    schema: z.object({
        entity_id: z.string().describe("Id of the entity to walk to"),
    }),
    handler: async (agent: Agent, args) => {
        let mbot = agent.mineflayerBot!;

        let entity = mbot.entities[args.entity_id];
        if (!entity) return `Entity with ID ${args.entity_id} is not found!`;

        const defaultMove = new Movements(agent.mineflayerBot!)
        mbot.pathfinder.setMovements(defaultMove)

        let pos = entity.position;
        let goal = new goals.GoalNear(pos.x, pos.y, pos.z, 2);
        await mbot.pathfinder.goto(goal);
        return `Reached to ${args.entity_id} at (${pos.x}, ${pos.y}, ${pos.z})`;
    }
})

LLMFunctions.register({
    gameMode: "any",
    name: "attack_entity",
    description: "You can use this function to attack an entity or mobs for farm or other purposes",
    schema: z.object({
        entity_id: z.string().describe("The id of the entity to attack")
    }),
    handler: async (agent: Agent, args) => {
        let entity = agent.mineflayerBot!.entities[args.entity_id];
        if (!entity) return `Entity with ID ${args.entity_id} is not found!`

        agent.mineflayerBot!.pvp.attack(entity)
        return {
            message: `Attacking entity ${args.entity_id}`,
            stop_calling: true
        }
    }
})

LLMFunctions.register({
    gameMode: "any",
    name: "get_nearby_entities",
    description: "Get the nearby entities",
    schema: z.object({
        max_distance: z.number().describe("The maximum distance to search for entities. Use 1000 for unlimited distance.")
    }),
    handler: async (agent: Agent, args) => {
        return {
            message: getNearbyEntities(agent, args.max_distance).map(({entity_id, entity, distance}) => ({
                distance,
                entity_id,
                name: entity.name,
                ...(entity.username && { username: entity.username })
            }))
        }
    }
})

LLMFunctions.register({
    gameMode: "any",
    name: "set_todo_list",
    description: "Set the todo list",
    schema: z.object({
        todo_list: z.string().describe("Write detailed description of the todo list. Use markdown format")
    }),
    handler: async (agent: Agent, args) => {
        agent.todoList = args.todo_list

        return {
            message: "Todo list set"
        }
    }
})

