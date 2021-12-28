require('dotenv').config();
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const client_pass = new Client({ intents: [Intents.FLAGS.GUILDS] });
const timeUntil = require('time-until');


const gameReleaseDate = new Date(2021, 11, 30, 12, 0, 0);
const passReleaseDate = new Date(2022, 0, 3, 12, 0, 0);
client.on('ready', UpdateStatusCountdown(gameReleaseDate, false, client));
client_pass.on('ready', UpdateStatusCountdown(passReleaseDate, true, client_pass));

client.login(process.env.DISCORD_TOKEN);
client_pass.login(process.env.PASS_DISCORD_TOKEN);

/* 
 * @description Updates discord status to "time until game release" with formatted date countdown using time-until package
    * @param {Date} endDate - date of game/pass release
    * @param {boolean} ish - is the date specific (false), or non-specific (true)
 */
function UpdateStatusCountdown(endDate, ish, CLIENT) {
    return async () => {
        UpdateStatus(endDate);

        setInterval(() => {
            UpdateStatus(endDate);
        }, 1000 * 60);

        function UpdateStatus(endDate) {

            // if endDate has passed, set status to offline
            if (endDate < Date.now()) {
                CLIENT.user.setStatus('invisible');
                console.log('Game is launched, setting status to invisible');
                process.exit(0);
            }

            // set discord status to "time until game release" with formatted date countdown using time-until package
            CLIENT.user.setActivity("Countdown ⏰: " + (ish ? "est. ~" : "") +timeUntil(endDate).string + (ish ? "+" : ""), { type: 'PLAYING' });
        }
    };
}

