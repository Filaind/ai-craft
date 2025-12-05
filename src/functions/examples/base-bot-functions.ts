
import { Vec3 } from 'vec3';
import { z } from "zod";
import { Entity } from "prismarine-entity"
import { goals } from "@miner-org/mineflayer-baritone"

import { LLMFunctions } from "../llm-functions"
import type { Agent } from "../../agent"

export interface NearbyEntityInfo {
    entity_id: string,
    distance: number,
    //direction: number,
    entity: Entity
}

export function angleSubtract(a: number, b: number): number {
  let d = a - b;
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d;
}

export function getNearbyEntities(agent: Agent, maxDistance: number = 100) {
    let entity_distances: NearbyEntityInfo[] = [];
    for (const [entity_id, entity] of Object.entries(agent.bot!.entities)) {
        if (entity.username == agent.bot!.username) continue;

        const distance = entity.position.distanceTo(agent.bot!.entity.position);
        if (maxDistance && distance > maxDistance) continue;

        //let diff = entity.position.subtract(agent.bot!.entity.position);
        //const direction = Math.atan2(diff.z, diff.y) * (180 / Math.PI); // horizontal direction

        entity_distances.push({
            entity_id,
            distance,
            //direction: angleSubtract(direction, agent.bot!.entity.yaw),
            entity
        });
    }
    entity_distances.sort((a, b) => a.distance - b.distance);
    return entity_distances;
}

LLMFunctions.register({
    name: "walk_to_position",
    description: "Walk to specified coordinates",
    schema: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
    }),
    handler: async (agent: Agent, args) => {
        const goal = new goals.GoalExact(new Vec3(args.x, args.y, args.z));
        await agent.bot!.ashfinder.gotoSmart(goal, {
            waypointThreshold: 75, // Use waypoints for distances > 75 blocks
            forceWaypoints: false, // Force waypoint usage
            forceAdaptive: true, // Use smart waypoint system with failure handling
        });

        return { message: `Reached to (${args.x}, ${args.y}, ${args.z})` };
    }
})

LLMFunctions.register({
    name: "walk_to_entity",
    description: "Walk to entity that is specified by entity_id. List of nearby entities can be obtained using get_nearby_entities.",
    schema: z.object({
        entity_id: z.string().describe("Id of the entity to walk to"),
    }),
    handler: async (agent: Agent, args) => {
        let mbot = agent.bot!;

        let entity = mbot.entities[args.entity_id];
        if (!entity) return `Entity with ID ${args.entity_id} is not found!`;

        let pos = entity.position;
        const goal = new goals.GoalExact(new Vec3(pos.x, pos.y, pos.z));
        
        await agent.bot!.ashfinder.gotoSmart(goal, {
            waypointThreshold: 75, // Use waypoints for distances > 75 blocks
            forceWaypoints: false, // Force waypoint usage
            forceAdaptive: true, // Use smart waypoint system with failure handling
        });

        return { message: `Reached to ${args.entity_id} at (${pos.x}, ${pos.y}, ${pos.z})` };
    }
})

LLMFunctions.register({
    name: "attack_entity",
    description: "You can use this function to attack an entity or mobs for farm or other purposes",
    schema: z.object({
        entity_id: z.string().describe("The id of the entity to attack")
    }),
    handler: async (agent: Agent, args) => {
        let entity = agent.bot!.entities[args.entity_id];
        if (!entity) return `Entity with ID ${args.entity_id} is not found!`

        agent.bot!.pvp.attack(entity)
        return {
            message: `Attacking entity ${args.entity_id}`,
            stop_calling: true
        }
    }
})

LLMFunctions.register({
    name: "get_nearby_entities",
    description: "Get the nearby entities. Returns list of: entity_id, distance (meters), entity_type, username (if player)",
    schema: z.object({
        max_distance: z.number().min(20).max(1000).optional().describe("The maximum distance to search for entities. Default: 100")
    }),
    handler: async (agent: Agent, args) => {
        return {
            message: getNearbyEntities(agent, args.max_distance).map(({ entity_id, distance, entity }) => ({
                entity_id,
                distance,
                //direction,
                entity_type: entity.type,
                ...(entity.username && { username: entity.username })
            }))
        }
    }
})
