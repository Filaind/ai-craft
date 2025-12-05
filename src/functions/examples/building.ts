
import OpenAI from "openai";

import { Vec3 } from 'vec3';
import { z } from "zod";

import { LLMFunctions } from "../llm-functions"
import type { Agent } from "../../agent"
import type { ChatCompletion } from "openai/resources";

interface MinecraftStructure {
    size: Vec3;
    structure: string[][][];
}

const structurePromptTemplate = `
Generate a minecraft structure based on this description:
{description}

Output result in following format:
S,x,y,z
Y,0
Z,0,block_id,block_id,block_id ...
Z,1,...
Z ,...
Y,1
...
E

Where:
S,x,y,z - size of structure
Y - index of current horizontal 2D slice, starting from the bottom
Z - horizontal stripe of block_ids in the current slice
block_id - minecraft block id with no "minecraft:" tag
E - end of the structure

We MUST have 'y' number of layers
Each layer MUST have 'z' number of stripes
Each stripe MUST have 'x' number of blocks
`

function parseStructure(structure: string): MinecraftStructure | string {
    let ret: MinecraftStructure = {
        size: new Vec3(0,0,0),
        structure: []
    };

    let lines = structure.toLowerCase().split('\n')
    let y: number = -1, z: number = -1;

    for (let line of lines) {
        let args = line.trim().split(',');
        if (args.length == 0) {
            continue; // skip empty lines
        }
        switch (args[0]) {
            case 's':
                if (args.length != 4) {
                    return `Invalid structure size! Line: '${line}'`;
                }
                ret.size = new Vec3(parseInt(args[1]!), parseInt(args[2]!), parseInt(args[3]!));
                // Preallocate 3D structure with "air" blocks
                ret.structure = Array.from({ length: ret.size.y }, () =>
                    Array.from({ length: ret.size.z }, () =>
                        Array.from({ length: ret.size.x }, () => "air")
                    )
                );
                break;
            case 'y':
                if (args.length != 2) {
                    return `Invalid Y index! Line: '${line}'`;
                }
                let new_y = parseInt(args[1]!);
                if ((new_y - y) != 1) {
                    return `Y slices must be sequential!`;
                }
                y = new_y;
                z = -1;
                break;
            case 'z':
                if (args.length != (ret.size.x + 2)) {
                    return `Invalid Z stripe length! Line: '${line}'`;
                }
                let new_z = parseInt(args[1]!);
                if ((new_z - z) != 1) {
                    return `Z stripes must be sequential!`;
                }
                z = new_z;
                for (let x = 0; x < (args.length - 2); x++) {
                    ret.structure[y]![z]![x] = args[x + 2]!;
                }
                break;
            case 'e':
                return ret; // done!
            default:
                break;
                //return `Invalid line: ${line}`;
        }
    }
    return ret;
}

async function generateStructure(agent: Agent, description: string): Promise<MinecraftStructure | string> {
    let messages: OpenAI.ChatCompletionMessageParam[] = [{
        role: "user",
        content: structurePromptTemplate.replace("{description}", description)
    }]
    for (let attempt = 0; attempt < 3; attempt++) {
        let response = await agent.llm.generateSimple(messages)
        let message = response.choices[0]?.message;
        if (message && message.content) {
            messages.push({
                role: "assistant",
                content: message.content
            })
            try {
                let ret = parseStructure(message.content);
                console.log(message.content);
                if (typeof(ret) === "string") {
                    messages.push({
                        role: "user",
                        content: ret
                    })
                } else {
                    return ret;
                }
            } catch (e) {
                messages.push({
                    role: "user",
                    content: JSON.stringify(e)
                })
            }
        }
    }
    return "Failed to generate structure!";
}

LLMFunctions.register({
    name: "generate_structure",
    description: "Generate building structure based on provided description at specified point",
    schema: z.object({
        description: z.string(),
        origin: z.object({
            x: z.int(),
            y: z.int(),
            z: z.int(),
        }).describe("Origin point of the structure in the world"),
    }),
    handler: async (agent: Agent, args) => {
        let structure = await generateStructure(agent, args.description);
        if (typeof(structure) === "string") {
            return {
                result: "error",
                message: structure
            }
        }
        for (let y = 0; y < structure.size.y; y++) {
            for (let z = 0; z < structure.size.z; z++) {
                for (let x = 0; x < structure.size.x; x++) {
                    agent.bot!.chat(`/setblock ${args.origin.x + x} ${args.origin.y + y} ${args.origin.z + z} ${structure.structure[y]![z]![x]!}`)
                }
            }
        }
        return {
            result: "success",
            message: "Structure is generated!"
        }
    }
})