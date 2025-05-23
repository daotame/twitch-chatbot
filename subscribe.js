require('dotenv').config();
const axios = require('axios');

const TWITCH_API_BASE = 'https://api.twitch.tv/helix/eventsub/subscriptions';

async function getAccessToken() {
    const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials'
        }
    });
    return res.data.access_token;
}

async function listSubscriptions(token) {
    const res = await axios.get(TWITCH_API_BASE, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        }
    });
    return res.data.data;
}

async function deleteSubscription(id, token) {
    await axios.delete(`${TWITCH_API_BASE}?id=${id}`, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        }
    });
    console.log(`Deleted existing subscription: ${id}`);
}
async function createSubscription(token) {
    const payload = {
        type: 'channel.channel_points_custom_reward_redemption.add',
        version: '1',
        condition: {
            broadcaster_user_id: process.env.BROADCASTER_ID
        },
        transport: {
            method: 'webhook',
            callback: `${process.env.EVENTSUB_CALLBACK_URL}`,
            secret: process.env.EVENTSUB_SECRET
        }
    };

    const res = await axios.post(TWITCH_API_BASE, payload, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    console.log('EventSub subscription created:', res.data);
}

async function getSubscriptions(token) {
    const res = await axios.get(TWITCH_API_BASE, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
        }
    });
    console.log(JSON.stringify(res.data, null, 2));
}

(async () => {
    try {
        const token = await getAccessToken();
        const subscriptions = await listSubscriptions(token);

        for (const sub of subscriptions) {
            if (
                sub.type === 'channel.channel_points_custom_reward_redemption.add' &&
                sub.condition.broadcaster_user_id === process.env.BROADCASTER_ID
            ) {
                await deleteSubscription(sub.id, token);
            }
        }
        await createSubscription(token);
        await getSubscriptions(token);
    } catch (error) {
        console.error('Failed to subscribe:', err.response?.data || err.message);
    }
})();