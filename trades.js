require('dotenv').config();
const Discord = require('discord.js');
const { Client, Intents } = Discord;
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const client_fondue = new Client({ intents: [Intents.FLAGS.GUILDS] });
const timeUntil = require('time-until');
const rxjs = require('rxjs');
const {switchMap, pairwise, filter, map, distinctUntilChanged, tap} = require('rxjs/operators');
const fetch = require('node-fetch');
const lodash = require('lodash')
const fs = require('fs');

const observable = rxjs.interval(1000 * 3);

function $APIData(url, override) {
    return observable.pipe(switchMap(() => GetUrlData(url)))

    function GetUrlData(_url) {
        return (override ? override(_url) : fetch(_url, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en-US,en;q=0.9",
            },
            "body": null,
            "method": "GET"
        })
            .then(res => res.json()))
    }
}

// compare previous and next market data using lodash to see if there is a new items by comparing _id
async function checkForDifferentId(previousMarketData, nextMarketData) {
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
    2: "traps",
    3: "passes"
}

const TYPES_SINGULAR = {
    0: "mouse",
    1: "cat",
    2: "trap",
    3: "pass"
}

let totalFees = 0;

(async () => {
    const latestActivity = (await $APIData("https://graph.t.hmny.io/subgraphs/name/fondue", (url) => fetch(url, {
        "headers": {
          "accept": "application/json",
          "accept-language": "en-US,en;q=0.9",
          "content-type": "application/json",
        },    
        "body": "{\"query\":\"{\\n  _meta {\\n    block { number }\\n  }\\n  \\n  migrations(first: 10, subgraphError: allow) {\\n    id,\\n    createdAt,\\n    transaction,\\n    amountOfKeys,\\n    amountOfFondue\\n    address\\n  }\\n  \\n \\n  \\n  purchases (first: 20, orderBy: createdAt, orderDirection: desc) {\\n    createdAt\\n    amount\\n  id\\n    purchaser\\n  }\\n  \\n  takeThePots (first: 20, orderBy: createdAt, orderDirection: desc) {\\n    createdAt\\n    amount\\n    id\\n    depositer\\n  }\\n}\",\"variables\":null,\"operationName\":null}",
        "method": "POST",
      }).then(b => b.json()).then(d => d.data))).pipe(filter(x => !!x));

      const latestMints = latestActivity.pipe(map(x => {
          if(!x) process.exit(0);
          return x.purchases[0]
      }), pairwise(), filter(x => x[0]?.createdAt !== x[1]?.createdAt), map(([a, b]) => {
          return b;
      }), distinctUntilChanged());

      const takeThePots = latestActivity.pipe(map(x => {
        return x.takeThePots[0]
    }), pairwise(), filter(x => x[0]?.createdAt !== x[1]?.createdAt), map(([a, b]) => {
        return b;
    }, distinctUntilChanged()));
    client_fondue.on('ready', () => {
        latestMints.subscribe(async ({amount, createdAt, purchaser, id, cost}) => {
            const commaSeperattedList = process.env.FONDUE_ACTIVITY_CHANNEL_IDS.toString();
            console.log(commaSeperattedList, 'csv');
            commaSeperattedList.split(",").forEach(async channelId => {
                const channel = client_fondue.channels.cache.get(channelId);
                if(!channel) return console.warn("Can't find channel with id " + process.env.FONDUE_ACTIVITY_CHANNEL_IDS);
                const buyer = purchaser.slice(0, 5) + "..." + purchaser.slice(-5);
                const embed = new Discord.MessageEmbed()
                    .setColor('#7dd88d')
                    .setTitle(`New Key${Number(amount) == 1 ? "" : "s"} Minted!`)

                embed.addField(`${buyer} minted ${amount} key${Number(amount) == 1 ? "" : "s"}!`, 'https://fondue.land/');


                await channel.send({embeds: [embed]});
                // log mint
                console.log(`${buyer} minted ${amount}x keys! @${Number(cost)/10**9/Number(amount)}/ea`);
            })
        });
        takeThePots.subscribe(async ({amount, depositer, id}) => {
            if(Number(amount) < 10 ** 9) return console.warn("Not enough fondue to pay for a deposit");
            const commaSeperattedList = process.env.FONDUE_ACTIVITY_CHANNEL_IDS.toString();
            commaSeperattedList.split(",").forEach(async channelId => {
                const channel = client_fondue.channels.cache.get(channelId);
                if(!channel) return console.warn("Can't find channel with id " + process.env.FONDUE_ACTIVITY_CHANNEL_IDS);
                const embed = new Discord.MessageEmbed()
                    .setColor('#FFD700')
                    .setTitle(`The Pot has been Taken!`)

                const buyer = depositer.slice(0, 5) + "..." + depositer.slice(-5);
                embed.addField(`${buyer} has taken the pot with ${amount} key${(Number(amount) / 10 ** 9) == 1 ? "" : "s"}!`, "https://fondue.land/");
                await channel.send({embeds: [embed]});
                // log steal
                console.log(`${buyer} has taken the pot with ${amount}x key${Number(amount) == 1 ? "" : "s"}!`);
            })
        });
    })
      

    client_fondue.login(process.env.DISCORD_TOKEN_FONDUE);
})();

(async () => {
    // login to discord

    // pipe and extend observable to run fetch every minute to get latestMarketData
    const latestMarketData = await $APIData(
        "https://api.cheesedao.xyz/apiv1/marketplace/sellFeed/?page=0&pageSize=25&sortBy=created&sort=DSC&token=0x4e9c30CbD786549878049f808fb359741BF721ea"
    )
    const latestMiceListingData = await $APIData(
        "https://api.cheesedao.xyz/apiv1/marketplace/listings/?tokenId=0&sortBy=price&sort=ASC&page=0&pageSize=100&token=0x4e9c30CbD786549878049f808fb359741BF721ea"
    )
    const latestCatListingData = await $APIData(
        "https://api.cheesedao.xyz/apiv1/marketplace/listings/?tokenId=1&sortBy=price&sort=ASC&page=0&pageSize=100&token=0x4e9c30CbD786549878049f808fb359741BF721ea"
    )
    const latestTrapListingData = await $APIData(
        "https://api.cheesedao.xyz/apiv1/marketplace/listings/?tokenId=2&sortBy=price&sort=ASC&page=0&pageSize=100&token=0x4e9c30CbD786549878049f808fb359741BF721ea"
    )

    const latestTrapSales = await $APIData(
        "https://api.cheesedao.xyz/apiv1/marketplace/sellFeed/?page=0&pageSize=25&sortBy=created&sort=DSC&token=0x4175c4A80c13604D93b6BAfE90aBfc80ca37F718"
        )
        
    const latestPassListingData = await $APIData(
        "https://api.cheesedao.xyz/apiv1/marketplace/listings/?tokenId=0&sortBy=price&sort=ASC&page=0&pageSize=100&token=0x4175c4A80c13604D93b6BAfE90aBfc80ca37F718"
    )


    // pipe and extend latestMarketData with pairwaise comparison to check for new items
    const newCatMiceTrapSales = latestMarketData.pipe(
        pairwise(),
        switchMap(([prev, curr]) => {
            return checkForDifferentId(prev, curr)
        }),
        filter(items => items.length > 0)
    );
    const newMiceListings = latestMiceListingData.pipe(
        distinctUntilChanged((a, b) => a[0].price == b[0].price),
        pairwise(),
        switchMap(([prev, curr]) => {
            return checkForDifferentId(prev, curr)
        }),
        filter(items => items.length > 0),
        map(items => items.map(i => {return i}).sort((a, b) => a.price - b.price)),
    );
    const newCatListings = latestCatListingData.pipe(
        distinctUntilChanged((a, b) => a[0].price == b[0].price),
        pairwise(),
        switchMap(([prev, curr]) => {
            return checkForDifferentId(prev, curr)
        }),
        filter(items => items.length > 0),
        map(items => items.map(i => {return i}).sort((a, b) => a.price - b.price)),
    );
    const newTrapListings = latestTrapListingData.pipe(
        distinctUntilChanged((a, b) => a[0].price == b[0].price),
        pairwise(),
        switchMap(([prev, curr]) => {
            return checkForDifferentId(prev, curr)
        }),
        filter(items => items.length > 0),
        map(items => items.map(i => {return i}).sort((a, b) => a.price - b.price)),
    );
    const newPassSales = latestTrapSales.pipe(
        pairwise(),
        switchMap(([prev, curr]) => {
            return checkForDifferentId(prev, curr)
        }),
        filter(items => items.length > 0),
        map(items => items.map(i => {i.tokenId = 3; return i}))
    );
    const newPassListings = latestPassListingData.pipe(
        distinctUntilChanged((a, b) => a[0].price == b[0].price),
        pairwise(),
        switchMap(([prev, curr]) => {
            return checkForDifferentId(prev, curr)
        }),
        filter(items => items.length > 0),
        map(items => items.map(i => {i.tokenId = 3; return i;}).sort((a, b) => a.price - b.price)),
    );


    client.on('ready', () => {

        if (!fs.existsSync('./cheese-fees.txt')) {
            fs.writeFileSync('./cheese-fees.txt', 6717+"");
        }
    
        fs.readFile('cheese-fees.txt', 'utf8', function (err, contents) {
            if (err) {
                return console.log(err);
            }
            totalFees = parseFloat(contents);
    
            // update activity
            client.user.setActivity(`~${Math.floor(totalFees)} 🧀 from fees`, { type: 'WATCHING' });
        });
    
        // log newItems to console
        newCatMiceTrapSales.subscribe(async newItems => {
            const commaSeperattedList = process.env.MARKET_ACTIVITY_CHANNEL_IDS.toString();
            commaSeperattedList.split(",").forEach(async channelId => {
                const channel = client.channels.cache.get(channelId);
                if(!channel) return console.warn("Can't find channel with id " + process.env.MARKET_ACTIVITY_CHANNEL_IDS);
                await NewSale(newItems, channel);
            })
        })
    
        newPassSales.subscribe(async newItems => {
            const commaSeperattedList = process.env.MARKET_ACTIVITY_CHANNEL_IDS.toString();
            commaSeperattedList.split(",").forEach(async channelId => {
                const channel = client.channels.cache.get(channelId);
                if(!channel) return console.warn("Can't find channel with id " + process.env.MARKET_ACTIVITY_CHANNEL_IDS);
                await NewSale(newItems, channel);
            })
        })
    
        // log listings to chat
        newMiceListings.subscribe(async listings => {
            const commaSeperattedList = process.env.MARKET_LISTING_CHANNEL_IDS.toString();
            commaSeperattedList.split(",").forEach(async channelId => {
                const channel = client.channels.cache.get(channelId);
                if(!channel) return console.warn("Can't find channel with id " + process.env.MARKET_ACTIVITY_CHANNEL_IDS);
                // await NewListing(listings, channel);
            })
        })
        // log listings to chat
        newCatListings.subscribe(async listings => {
            const commaSeperattedList = process.env.MARKET_LISTING_CHANNEL_IDS.toString();
            commaSeperattedList.split(",").forEach(async channelId => {
                const channel = client.channels.cache.get(channelId);
                if(!channel) return console.warn("Can't find channel with id " + process.env.MARKET_ACTIVITY_CHANNEL_IDS);
                // await NewListing(listings, channel);
            })
        })
        // log listings to chat
        newTrapListings.subscribe(async listings => {
            const commaSeperattedList = process.env.MARKET_LISTING_CHANNEL_IDS.toString();
            commaSeperattedList.split(",").forEach(async channelId => {
                const channel = client.channels.cache.get(channelId);
                if(!channel) return console.warn("Can't find channel with id " + process.env.MARKET_ACTIVITY_CHANNEL_IDS);
                // await NewListing(listings, channel);
            })
        })
        // log listings to chat
        newPassListings.subscribe(async listings => {
            const commaSeperattedList = process.env.MARKET_LISTING_CHANNEL_IDS.toString();
            commaSeperattedList.split(",").forEach(async channelId => {
                const channel = client.channels.cache.get(channelId);
                if(!channel) return console.warn("Can't find channel with id " + process.env.MARKET_ACTIVITY_CHANNEL_IDS);
                // await NewListing(listings, channel);
            })
        })
    });
    
    client.login(process.env.MARKET_ACTIVITY_DISCORD_TOKEN);
})();

async function NewSale(newItems, channel) {
    const embed = new Discord.MessageEmbed()
        .setColor('#FFD700')
        .setTitle(`New Sale${newItems.length > 1 ? "s" : ""}`)

    for (let listing of newItems) {

        // if cheese-fees.txt doesn't exist, generate it
        if (!fs.existsSync('./cheese-fees.txt')) {
            fs.writeFileSync('./cheese-fees.txt', 6717+"");
        }
        // take 5% of the listing and add it to the number residing in cheese-fees.txt
        const fee = listing.price/Math.pow(10,9) * 0.05;
        fs.readFile('cheese-fees.txt', 'utf8', function (err, contents) {
            if (err) {
                return console.log(err);
            }
            totalFees = parseFloat(contents) + fee;

            // update activity
            client.user.setActivity(`(5% fees) ~${Math.floor(totalFees)} 🧀`, { type: 'WATCHING' });

            fs.writeFile('cheese-fees.txt', totalFees.toString(), function (err) {
                if (err) return console.log(err);
            });
        });

        const buyer = listing.admin.slice(0, 5) + "..." + listing.admin.slice(-5);
        const type = listing.amount == 1 ? TYPES_SINGULAR[listing.tokenId] : TYPES[listing.tokenId];
        embed.addField(`${listing.amount}x ${type.slice(0,1).toUpperCase()+type.slice(1)} @ ${listing.price/Math.pow(10,9)/listing.amount}  🧀  each!`, `Total: ${listing.price/Math.pow(10,9)} 🧀 - Bought by ${buyer}\n(5% Market Fee: ${(listing.price/Math.pow(10,9)*0.05).toFixed(3)} 🧀)`)
    }
    await channel.send({embeds: [embed]});
    console.log("Posted new sale!");
}
async function NewListing(newItems, channel) {
    const embed = new Discord.MessageEmbed()
        .setColor('#FF00FF')
        .setTitle(`New Lowest Price${newItems.length > 1 ? "s" : ""}`)
    for (let listing of newItems) {
        const type = listing.amount == 1 ? TYPES_SINGULAR[listing.tokenId] : TYPES[listing.tokenId];
        embed.addField(`${listing.amount}x ${type.slice(0,1).toUpperCase()+type.slice(1)} @ ${listing.price/Math.pow(10,9)}  🧀  ${newItems.length > 1 ? "each" : ""}!`, `Total: ${listing.price/Math.pow(10,9) * listing.amount} 🧀 - Listed by ${listing.admin.slice(0, 5) + "..." + listing.admin.slice(-5)}`)
    }
    await channel.send({embeds: [embed]});
    console.log("Posted new listing!");
}



