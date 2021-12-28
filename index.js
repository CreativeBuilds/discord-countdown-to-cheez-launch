require('dotenv').config();
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const timeUntil = require('time-until');


client.on('ready', () => {
    UpdateStatus();

    setInterval(() => {
        UpdateStatus(); 
    }, 1000*60);

    function UpdateStatus() {
        const gameReleaseDate = new Date(2021, 11, 30, 12, 0, 0);

        // if gamereleasedate has passed, set status to offline
        if (gameReleaseDate < Date.now()) {
            client.user.setStatus('invisible');
            console.log('Game is launched, setting status to invisible');
            process.exit(0);
        }

        // set discord status to "time until game release" with formatted date countdown using time-until package
        console.log(timeUntil(gameReleaseDate).string);
        let presence = client.user.setActivity("⏰: " + timeUntil(gameReleaseDate).string, { type: 'PLAYING' });
    }

});

client.login(process.env.DISCORD_TOKEN);