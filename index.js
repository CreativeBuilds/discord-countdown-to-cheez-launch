const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const timeUntil = require('time-until')

client.on('ready', () => {
    setInterval(() => {
        gameReleaseDate = new Date(2021, 12, 30, 12, 42, 42);
        // if gamereleasedate has passed, set status to offline
        if (gameReleaseDate < Date.now()) {
            client.user.setStatus('invisible');
            console.log('Game is launched, setting status to invisible');
            process.exit(0);
        } 

        // set discord status to "time until game release" with formatted date countdown using time-until package
        client.user.setActivity(`GAME RELEASE COUNTDOWN: ${timeUntil(gameReleaseDate).string}`, { type: 'STREAMING' }); 
    }, 1000*60)

});

client.login(process.env.DISCORD_TOKEN);