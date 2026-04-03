let AccessToken = null;

// livekit-server-sdk is ESM-only ("type": "module"), so require() fails.
// FiveM's Node 22 runtime doesn't reliably support top-level await or dynamic import().
// Workaround: require the CJS dist directly if available, otherwise try dynamic import on first use.
const resourcePath = GetResourcePath(GetCurrentResourceName());

try {
  // Try loading the CommonJS build directly via absolute path
  const sdkPath = `${resourcePath}/server/js/node_modules/livekit-server-sdk/dist/index.cjs`;
  ({ AccessToken } = require(sdkPath));
} catch (_) {
  try {
    ({ AccessToken } = require(`${resourcePath}/server/js/node_modules/livekit-server-sdk`));
  } catch (_2) {
    try {
      ({ AccessToken } = require('livekit-server-sdk'));
    } catch (_3) {
      console.warn('[gcphone] livekit-server-sdk not found — LiveKit token generation disabled');
      console.warn('[gcphone] Run: cd server/js && npm install');
    }
  }
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
