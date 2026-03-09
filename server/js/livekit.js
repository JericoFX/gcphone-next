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

function clampDuration(value) {
  const configured = Number.isFinite(livekitMaxCallDuration) ? livekitMaxCallDuration : 300;
  const upper = Math.max(30, Math.min(3600, Math.floor(configured)));
  const requested = Number(value);
  if (!Number.isFinite(requested)) {
    return upper;
  }

  return Math.max(30, Math.min(upper, Math.floor(requested)));
}

on('gcphone:livekit:requestToken', async (src, requestId, roomName, identity, participantName, grants, maxDuration) => {
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

    const durationSeconds = clampDuration(maxDuration);

    try {
        const at = new AccessToken(livekitApiKey, livekitApiSecret, {
            identity: safeIdentity,
            name: safeName || safeIdentity,
            // Verified: livekit/node-sdks AccessToken accepts string TTL values like '30m'
            ttl: `${durationSeconds}s`,
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
