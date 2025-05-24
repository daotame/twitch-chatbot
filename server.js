require('dotenv').config();

// Set Up
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');

const crypto = require('crypto')
const express = require('express');
const app = express();
port = 3000;

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Creating New TMI Client
const client = new tmi.Client({
    connection: {
        reconnect: true
    },
    identity: {
		username: process.env.TWITCH_BOT_USERNAME,
		password: process.env.TWITCH_OAUTH_TOKEN
	},
	channels: [ 'daotama' ]
});


client.connect();

// Attendance File Setup
const attendanceFile = path.join(__dirname, 'attendance.json');

// Coin File Setup
const coinsFile = path.join(__dirname, 'coins.json');

// Gold File Setup
const goldFile = path.join(__dirname, 'gold.json');

// Global Attendance Structure
let attendance = {}

// Notification request headers
const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp'.toLowerCase();
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

// Notification message types
const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification';
const MESSAGE_TYPE_NOTIFICATION = 'notification';
const MESSAGE_TYPE_REVOCATION = 'revocation';

// Prepend this string to the HMAC that's created from the message
const HMAC_PREFIX = 'sha256=';

app.use(express.raw({          // Need raw message body for signature verification
    type: 'application/json'
}))  


app.post('/eventsub', (req, res) => {
    let secret = getSecret();
    let message = getHmacMessage(req);
    let hmac = HMAC_PREFIX + getHmac(secret, message);  // Signature to compare

    if (true === verifyMessage(hmac, req.headers[TWITCH_MESSAGE_SIGNATURE])) {
        console.log("signatures match");

        // Get JSON object from body, so you can process the message.
        let notification = JSON.parse(req.body);
        
        if (MESSAGE_TYPE_NOTIFICATION === req.headers[MESSAGE_TYPE]) {
            const eventType = notification.subscription.type;
            const event = notification.event;

            console.log(`Event type: ${notification.subscription.type}`);
            console.log(JSON.stringify(notification.event, null, 4));


            // Gold Donation Events
            if (eventType === 'channel.cheer') {
                const user = event.user_name;
                const bits = event.bits;
                addGold(user, bits * 2); // 1 bit = 1 Gold
                client.say(process.env.TWITCH_BOT_USERNAME, `${user} has given ${event.bits * 2} gold to the Cult! Praise be to the Sphinx!`)
            }

            else if (eventType === 'channel.subscribe') {
                const user = event.user_name;
                addGold(user, 500); // 1 sub = 500 Gold
                client.say(process.env.TWITCH_BOT_USERNAME, `${user} has given ${500} gold to the Cult! Praise be to the Sphinx!`)
            }

            else if (eventType === 'channel.subscription.gift') {
                const user = event.user_name;
                const giftCount = event.total || 1;
                addGold(user, 500 * giftCount); // 1 gifted sub = 500 Gold
                client.say(process.env.TWITCH_BOT_USERNAME, `${user} has given ${500} gold to the Cult! Praise be to the Sphinx!`)
            }


            // Attendance Event
            if (eventType === 'channel.channel_points_custom_reward_redemption.add'){
                const user = notification.event.user_name;
                const rewardTitle = notification.event.reward.title;

                if (rewardTitle === "Cult Attendance") {
                    //if (!attendance[user]) {
                    //    attendance[user] = { dates: [], last: null, streak: 0}
                   // }

                    //if (attendance[user].dates.includes(today)) {
                    //    return `${user}, you've already checked in today!`;
                    //}

                    //const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    //if (attendance[user].last === yesterday) {
                    //    attendance[user].streak += 1;
                    //} else {
                    //    attendance[user].streak = 1;
                    //}

                    //attendance[user].last = today;
                    //attendance[user].dates.push(today);

                    //saveAttendance();

                    const result = recordAttendance(user);
                    console.log(`[DEBUG] Attendance data:`, result);
                    client.say(process.env.TWITCH_BOT_USERNAME, `${user}, check-in recorded! ${result.streak} streaks`)

                } 
                
            }

            
            res.sendStatus(204);
        }
        else if (MESSAGE_TYPE_VERIFICATION === req.headers[MESSAGE_TYPE]) {
            res.set('Content-Type', 'text/plain').status(200).send(notification.challenge);
        }
        else if (MESSAGE_TYPE_REVOCATION === req.headers[MESSAGE_TYPE]) {
            res.sendStatus(204);

            console.log(`${notification.subscription.type} notifications revoked!`);
            console.log(`reason: ${notification.subscription.status}`);
            console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);
        }
        else {
            res.sendStatus(204);
            console.log(`Unknown message type: ${req.headers[MESSAGE_TYPE]}`);
        }
    }
    else {
        console.log('403');    // Signatures didn't match.
        res.sendStatus(403);
    }


    console.log("Proceed")
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})

function getSecret() {
    // This is the secret you pass 
    // when you subscribed to the event.
    if (!process.env.TWITCH_EVENTSUB_SECRET) {
        console.error('Secret not set in environment variables!');
        process.exit(1);
    }
    return process.env.TWITCH_EVENTSUB_SECRET;
}

// Build the message used to get the HMAC.
function getHmacMessage(request) {
    return (request.headers[TWITCH_MESSAGE_ID] + 
        request.headers[TWITCH_MESSAGE_TIMESTAMP] + 
        request.body);
}

// Get the HMAC.
function getHmac(secret, message) {
    return crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

// Verify whether our hash matches the hash that Twitch passed in the header.
function verifyMessage(hmac, verifySignature) {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(verifySignature));
}


// Setup Gold
let userGold = {};

// Load Gold File
try {
  if (fs.existsSync(goldFile)) {
    userGold = JSON.parse(fs.readFileSync(goldFile));
  }
} catch (err) {
  console.error('Error loading gold:', err);
}

// Function to add gold
function addGold(user, amount) {
  if (!userGold[user]) userGold[user] = 0;
  userGold[user] += amount;
  saveGold();
}

// Function to Save Gold
function saveGold() {
  fs.writeFileSync(goldFile, JSON.stringify(userGold, null, 2));
}

// Load Attendance File
try {
  if (fs.existsSync(attendanceFile)) {
    attendance = JSON.parse(fs.readFileSync(attendanceFile));
  }
} catch (err) {
  console.error('Error loading attendance:', err);
}

// Function to Save Attendance
function saveAttendance() {
  fs.writeFileSync(attendanceFile, JSON.stringify(attendance, null, 2));
}

// Custom Currency for user
let CultistCoins = {};

// Load saved coins
try {
  if (fs.existsSync(coinsFile)) {
    CultistCoins = JSON.parse(fs.readFileSync(coinsFile));
  }
} catch (err) {
  console.error('Error loading points:', err);
}

//Function to add coins
function addCoins(user, coins) {
  if (!CultistCoins[user]) CultistCoins[user] = 0;
  CultistCoins[user] += coins;
  saveCoins();
}

// Save coins to file
function saveCoins() {
  fs.writeFileSync(coinsFile, JSON.stringify(CultistCoins, null, 2));
}

// Global Variable for quiz management
const quizState = {
  active: false,
  answer: null,
  question: null,
  winners: new Set(),
  timeoutId: null
};

//Commands List
const commands = {
    attendance: {
        response: (tags) => {

            const username = tags.username;

            //if (!attendance[username]) {
            //    attendance[username] = { dates: [] };
            //}

            //const count = attendance[username]?.dates?.length || 0;

            const { data, error } = supabase
                .from('attendance')
                .select('*')
                .eq('username', username)
                .single();
            
            console.log(data);
            console.log(error)
            if (error || !data) {
                return `No attendance record found for ${username}.`;
            }

            const streak = data.streak || 0;
            const lastSeen = data.last || 'Never';
            const days = data.dates?.length || 0;

            return `${username} has attended ${days} time(s), last seen on ${lastSeen}, streak: ${streak} day(s).`;
        }
    },
    monthly: {
        response: () => {
            const counts = getMonthlyCounts(attendance);

            const sorted = Object.entries(counts)
                .filter(([, cnt]) => cnt > 0)              // only users with ≥1 check-in
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);                              // top 5

            if (sorted.length === 0){
                return `No one has checked in yet this month.`;
            }

            // Formatting Leaderboard
            const lines = sorted.map(
                ([user, cnt], i) => `${i+1}. ${user} — ${cnt} check-ins`
            );
            return `📅 Monthly Attendance Leaderboard:\n` + lines.join(' | ');
        }
    },
    streak: {
        response: (tags) => {
            const username = tags.username.toLowerCase();
            const data = attendance[username];
            const streak = data?.streak || 0;
            return `${username}, your current attendance streak is ${streak} day(s).`;
        }
    },
    coins: {
        response: (tags) => {
            if (!CultistCoins[tags.username]){
                CultistCoins[tags.username] = 0;
                saveCoins();
            }
            return `${tags.username}, you have ${CultistCoins[tags.username]} coins.`
        }
    },
    coinboard: {
        response: () => {
            const sorted = Object.entries(CultistCoins)
                .sort(([, a], [, b])=> b - a)
                .slice(0, 5);
            if (sorted.length === 0) return `No Coins Yet!`;

            return 'Leaderboard:\n' + sorted.map(([user, pts], i) =>
                `${i + 1}. ${user} — ${pts} coins`).join(' | ');
        }
    },
    wisdom: {
        response: (tags, channel, client) => {
            const outcomesPath = path.join(__dirname, 'outcomes.json');
            const tarots = require('./tarots.json')
            let outcomes;

            try {
                const data = fs.readFileSync(outcomesPath, 'utf8');
                outcomes = JSON.parse(data);

            } catch (err) {
                console.error('Failed to load outcomes.json:', err);
                return `@${tags.username}, The Sphinx is confused right now...`;
            }

            if (!CultistCoins[tags.username]) {
                CultistCoins[tags.username] = 0;
                saveCoins();
            }

            console.log(CultistCoins[tags.username])

            if (CultistCoins[tags.username] < 500) {
                return `${tags.username}, you need at least 500 coins to seek Her wisdom.`;
            } 

            // Deduct 500 coins
            CultistCoins[tags.username] -= 500;
            saveCoins();

            const isGood = Math.random() < 0.5;
            if (!isGood){
                const list = outcomes.bad;
                const outcome = list[Math.floor(Math.random() * list.length)];
                return `${tags.username}... ${outcome}`;
            } else{
                const list = outcomes.good;
                const outcome = list[Math.floor(Math.random() * list.length)];
                const randomTarot = tarots[Math.floor(Math.random() * tarots.length)];
                console.log(randomTarot)
                client.say(channel, `${tags.username}... ${outcome} ${randomTarot.description}`);
            }
        }
    },
    quiz: {
        response: (tags, channel, client) =>{
            if (!isModOrBroadcaster(tags)){
                return ""
            }
            if (quizState.active) {
                return "There is already a quiz ongoing! Please wait for it to finish.";
            }
            const questions = require('./questions.json');

            const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
            console.log(randomQuestion)

            quizState.active = true;
            quizState.question = randomQuestion.q;
            quizState.answer = randomQuestion.a;
            quizState.winners = new Set();

            client.say(channel, `📢 QUIZ TIME: ${quizState.question} (You have 30 seconds to answer!)`);

            // Set 30 second timeout
            quizState.timeoutId = setTimeout(() => {
                quizState.active = false;

                if (quizState.winners.size === 0) {
                    client.say(channel, `⏱ Time's up! No one got the correct answer. It was: ${quizState.answer}.`)
                    console.log(`⏱ Time's up! No one got the correct answer. It was: ${quizState.answer}.`)
                } else {
                    const winners = [...quizState.winners].join(', ');
                    //reward users here
                    quizState.winners.forEach(user => addCoins(user, 500));
                    client.say(channel, `✅ Time's up! Congrats to: ${winners}! It was ${quizState.answer}. They have been awarded with 500 Coins!"`)
                    console.log(`✅ Time's up! Congrats to: ${winners}! It was ${quizState.answer}. They have been awarded with 500 Coins!"`)
                }
            }, 30000);
            
        }

    },
    gold: {
        response: (tags) => {
            if (!userGold[tags.username]) {
                userGold[tags.username] = 0;
                saveGold()
            }
            return `${tags.username}, you have given ${userGold[tags.username]} gold to the cult.`
        }
    },
    goldtop: {
        response: () => {
            const sorted = Object.entries(userGold)
                .sort(([, a], [, b])=> b - a)
                .slice(0, 5);
            if (sorted.length === 0) return `No Coins Yet!`;

            return 'Leaderboard:\n' + sorted.map(([user, pts], i) =>
                `${i + 1}. ${user} — ${pts} gold given`).join(' | ');
        }
    },
    // Test Command
    test: {
        response: (tags, channel, client) => {
            client.say(channel, "Testing")
        }
    }
}

// Message Handler
client.on('message', (channel, tags, message) => {

    const commandName = message.trim().split(' ')[0].toLowerCase();

    if (commandName.startsWith('!')) {
        const cmd = commands[commandName.slice(1)];
        if (cmd) {
            const result = typeof cmd.response === 'function'
                ? cmd.response(tags, channel, client) 
                : cmd.response;

            if (result) {
                client.say(channel, result).catch(console.error);
            }
            return;
        }
    }

    // Quiz answer checking
    if (quizState.active && message.trim().toLowerCase() === quizState.answer.toLowerCase()) {
        if (!quizState.winners.has(tags.username)){
            quizState.winners.add(tags.username);
        }
    }

	// "Alca: Hello, World!"
	console.log(`${tags['display-name']}: ${message}`);
});


//Function for Supabase Attendance Data Storage
async function recordAttendance(username, supabase) {
    const today = getTodayDateString()

    const { data: userData } = await supabase
        .from('attendance')
        .select('*')
        .eq('username', username)
        .single();

    if (!userData) {
        await supabase.from('attendance').insert({
            username,
            dates: [today],
            last: today,
            streak: 1
        });
            //return { new: true, dates: [today], last: today, streak: 1};
        } 

    const dates = userData.dates || [];
    const lastDates = userData.last;

    if (!dates.includes(today)) {
        const newDates = [...dates, today];
        const newStreak = userData.last === today ? userData.streak: userData.streak + 1;

        await supabase.from('attendance')
            .update({
                dates: newDates,
                last: today,
                streak: newStreak
            })
            .eq('username', username);

            //return { new: false, dates: newDates, last: today, streak: newStreak};
        }
}

// Helper Function to determine if user is moderator or broadcaster
function isModOrBroadcaster(tags){
    return tags.mod || tags.badges?.broadcaster === '1'
}

//Helper Function to get Today's Date
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// Helper Function for getting current month and year
function getCurrentMonthYear() {
    const current = new Date ();
    return {
        month: current.getUTCMonth(),
        year: current.getUTCFullYear()
    }
}

// Helper Function to get Monthly Attendance Count
function getMonthlyCounts(attendanceData) {
  const { month, year } = getCurrentMonthYear();
  const counts = {};

  for (const [user, entry] of Object.entries(attendanceData)) {
    // support both “array-only” or “metadata” entry shapes:
    const datesArray = Array.isArray(entry)
      ? entry
      : Array.isArray(entry.dates)
        ? entry.dates
        : [];

    counts[user] = datesArray.filter(dStr => {
      const d = new Date(dStr);
      return d.getUTCFullYear() === year
          && d.getUTCMonth()    === month;
    }).length;
  }

  return counts;
}