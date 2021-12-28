require('dotenv').config();
const Discord = require('discord.js');
const { Client, Intents } = Discord;
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const timeUntil = require('time-until');
const rxjs = require('rxjs');
const {switchMap, pairwise, filter} = require('rxjs/operators');
const fetch = require('node-fetch');
const lodash = require('lodash')

// with rxjs create observable that emits every minute
const observable = rxjs.interval(1000 * 3);

// pipe and extend observable to run fetch every minute to get latestMarketData
const latestMarketData = observable.pipe(
    switchMap(() => {
        return fetch("https://api.cheesedao.xyz/apiv1/marketplace/sellFeed/?page=0&pageSize=25&sortBy=created&sort=DSC", {
            "headers": {
              "accept": "application/json, text/plain, */*",
              "accept-language": "en-US,en;q=0.9",
              "Referer": "https://www.cheesedao.xyz/",
              "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            "body": null,
            "method": "GET"
          })
            .then(res => res.json())
            .then(data => {
                return data;
            })
    })
)

// pipe and extend latestMarketData with pairwaise comparison to check for new items
const newItems = latestMarketData.pipe(
    pairwise(),
    switchMap(([prev, curr]) => {
        return checkForNewItems(prev, curr)
    }),
    filter(items => items.length > 0)
);



// compare previous and next market data using lodash to see if there is a new items by comparing _id
async function checkForNewItems(previousMarketData, nextMarketData) {
    return lodash.differenceWith(nextMarketData, previousMarketData, (a, b) => {
        return a._id === b._id
    })
}

/* EXAMPLE LISTING SALE */
/* {
    _id: '61cb0966fabddcf2360e4c7e',
    offerId: '2721',
    admin: '0xB72C0Bd8e68De7de2Bf99abe238Ad7d18F9daaF7',
    token: '0x4e9c30CbD786549878049f808fb359741BF721ea',
    tokenId: 2,
    amount: 1,
    price: 8690000000,
    created: '2021-12-28T12:56:06.398Z',
    __v: 0
  }
 */

const TYPES = {
    0: "mice",
    1: "cats",
    2: "traps"
}

const TYPES_SINGULAR = {
    0: "mouse",
    1: "cat",
    2: "trap"
}

// function to send message to channel with new items in a discord embed with a yellow color
async function sendMessage(newItems, channel) {
    const embed = new Discord.MessageEmbed()
        .setColor('#FFD700')
        .setTitle(`New Sale${newItems.length > 1 ? "s" : ""}`)

    for (let listing of newItems) {
        const buyer = listing.admin.slice(0, 5) + "..." + listing.admin.slice(-5);
        const type = listing.amount == 1 ? TYPES_SINGULAR[listing.tokenId] : TYPES[listing.tokenId];
        embed.addField(`${listing.amount}x ${type.slice(0,1).toUpperCase()+type.slice(1)} @ ${listing.price/Math.pow(10,9)/listing.amount}  🧀  each!`, `Total: ${listing.price/Math.pow(10,9)} 🧀 - Bought by ${buyer}`)
    }
    await channel.send({embeds: [embed]});
    console.log("Posted new sale!");
}

client.on('ready', () => {

    // log newItems to console
    newItems.subscribe(async newItems => {
        const commaSeperattedList = process.env.MARKET_ACTIVITY_CHANNEL_IDS.toString();
        commaSeperattedList.split(",").forEach(async channelId => {
            const channel = client.channels.cache.get(channelId);
            if(!channel) return console.warn("Can't find channel with id " + process.env.MARKET_ACTIVITY_CHANNEL_IDS);
            await sendMessage(newItems, channel)
        })
    })
});

client.login(process.env.MARKET_ACTIVITY_DISCORD_TOKEN);

