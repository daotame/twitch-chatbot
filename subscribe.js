require('dotenv').config();
const axios = require('axios');

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

    const res = await axios.post('https://api.twitch.tv/helix/eventsub/subscriptions', payload, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    console.log('EventSub subscription created:', res.data);
}

(async () => {
    try {
        const token = await getAccessToken();
        await createSubscription(token);
    } catch (error) {
        console.error('Failed to subscribe:', err.response?.data || err.message);
    }
})();