import mineflayer from 'mineflayer'
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'


const bot = mineflayer.createBot({
    host: 'localhost',
    username: 'Bot',
    auth: 'offline',
    port: 25565,
})

bot.loadPlugin(pathfinder)

bot.on('chat', (username: string, message: string) => {
    if (username === bot.username) return
    bot.chat(message)
})

// Log errors and kick reasons:
bot.on('kicked', console.log)
bot.on('error', console.log)