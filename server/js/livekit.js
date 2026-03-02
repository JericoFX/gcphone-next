let AccessToken = null;

try {
  ({ AccessToken } = require('livekit-server-sdk'));
} catch (e) {
  AccessToken = null;
}

const livekitHost = GetConvar('livekit_host', process.env.livekit_host || '');
const livekitApiKey = GetConvar('livekit_api_key', process.env.livekit_api_key || '');
const livekitApiSecret = GetConvar('livekit_api_secret', process.env.livekit_api_secret || '');
const livekitRoomPrefix = GetConvar('livekit_room_prefix', process.env.livekit_room_prefix || 'gcphone');
const livekitMaxCallDuration = Number(GetConvar('livekit_max_call_duration', process.env.livekit_max_call_duration || 300));

function safeString(value, maxLen) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (!normalized) return '';
  return normalized.slice(0, maxLen);
}

function safeBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

on('gcphone:livekit:requestToken', async (src, requestId, roomName, identity, participantName, grants) => {
    const responseId = Number(requestId) || 1;

    if (!AccessToken) {
        emit('gcphone:livekit:tokenResponse', responseId, '', 'SDK_NOT_INSTALLED');
        return;
    }

    if (!livekitApiKey || !livekitApiSecret) {
        emit('gcphone:livekit:tokenResponse', responseId, '', 'MISSING_CREDENTIALS');
        return;
    }

    const safeRoom = safeString(roomName, 80);
    const safeIdentity = safeString(identity, 64);
    const safeName = safeString(participantName, 64);

    if (!safeRoom || !safeIdentity) {
        emit('gcphone:livekit:tokenResponse', responseId, '', 'INVALID_PAYLOAD');
        return;
    }

    try {
        const at = new AccessToken(livekitApiKey, livekitApiSecret, {
            identity: safeIdentity,
            name: safeName || safeIdentity,
            ttl: '10m',
        });

        at.addGrant({
            room: safeRoom,
            roomJoin: true,
            canPublish: safeBool(grants && grants.canPublish, true),
            canSubscribe: safeBool(grants && grants.canSubscribe, true),
            canPublishData: safeBool(grants && grants.canPublishData, true),
        });

        const token = await at.toJwt();
        emit('gcphone:livekit:tokenResponse', responseId, token, livekitMaxCallDuration.toString());
    } catch (e) {
        console.error('[livekit] token generation failed', e.message);
        emit('gcphone:livekit:tokenResponse', responseId, '', 'TOKEN_GENERATION_FAILED');
    }
});
