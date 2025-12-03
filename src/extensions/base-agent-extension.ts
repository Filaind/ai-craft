import type { Agent } from '../agent';

export class BaseAgentExtension {
    protected agent: Agent;

    constructor(agent: Agent) {
        this.agent = agent;
    }
}

