import type { Bot } from '../bot';

export class BaseBotExtension {
    protected bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }
}

