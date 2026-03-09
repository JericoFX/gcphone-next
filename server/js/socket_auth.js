let jwt = null;

try {
  jwt = require('jsonwebtoken');
} catch (e) {
  jwt = null;
}

function sanitize(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}

function sanitizeGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .map(g => String(g).replace(/[^0-9]/g, '').slice(0, 10))
    .filter(g => g.length > 0)
    .slice(0, 50);
}

function sanitizeRole(value) {
  const role = sanitize(value, 16).toLowerCase();
  return role === 'owner' ? 'owner' : role === 'viewer' ? 'viewer' : '';
}

on('gcphone:socket:requestToken', (requestId, phone, name, groups, identifier, snapLiveId, snapRole, snapUsername, snapDisplay, snapAvatar) => {
  const id = Number(requestId) || 0;
  if (!jwt) {
    emit('gcphone:socket:tokenResponse', id, '', 'JWT_SDK_NOT_INSTALLED');
    return;
  }

  const secret = GetConvar('gcphone_socket_jwt_secret', '');
  if (!secret) {
    emit('gcphone:socket:tokenResponse', id, '', 'JWT_SECRET_MISSING');
    return;
  }

  const safePhone = sanitize(phone, 20);
  const safeName = sanitize(name, 64);
  const safeIdentifier = sanitize(identifier, 80);
  if (!safePhone) {
    emit('gcphone:socket:tokenResponse', id, '', 'INVALID_PHONE');
    return;
  }

  const safeGroups = sanitizeGroups(groups);
  const safeSnapLiveId = String(snapLiveId || '').replace(/[^0-9]/g, '').slice(0, 16);
  const safeSnapRole = sanitizeRole(snapRole);
  const safeSnapUsername = sanitize(snapUsername, 32);
  const safeSnapDisplay = sanitize(snapDisplay, 64);
  const safeSnapAvatar = sanitize(snapAvatar, 255);

  try {
    const token = jwt.sign(
      {
        phone: safePhone,
        name: safeName || safePhone,
        groups: safeGroups,
        identifier: safeIdentifier,
        snapLiveId: safeSnapLiveId,
        snapRole: safeSnapRole,
        snapUsername: safeSnapUsername,
        snapDisplay: safeSnapDisplay,
        snapAvatar: safeSnapAvatar,
      },
      secret,
      { expiresIn: '10m' }
    );
    emit('gcphone:socket:tokenResponse', id, token, '');
  } catch (e) {
    emit('gcphone:socket:tokenResponse', id, '', 'JWT_SIGN_FAILED');
  }
});
