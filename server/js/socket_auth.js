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

on('gcphone:socket:requestToken', (requestId, phone, name) => {
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
  if (!safePhone) {
    emit('gcphone:socket:tokenResponse', id, '', 'INVALID_PHONE');
    return;
  }

  try {
    const token = jwt.sign(
      { phone: safePhone, name: safeName || safePhone },
      secret,
      { expiresIn: '10m' }
    );
    emit('gcphone:socket:tokenResponse', id, token, '');
  } catch (e) {
    emit('gcphone:socket:tokenResponse', id, '', 'JWT_SIGN_FAILED');
  }
});
