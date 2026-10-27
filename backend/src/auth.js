import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET;

export function shouldExtendLogin(role, requested) {
  return requested === true && (role === 'provider' || role === 'patient');
}

export function signToken(user, extendedLogin = false) {
  if (!jwtSecret) throw new Error('JWT_SECRET is required');
  return jwt.sign({ id: user.id, role: user.role, name: user.full_name, email: user.email, authVersion: Number(user.auth_version || 0) }, jwtSecret, { expiresIn: extendedLogin ? '14d' : '12h' });
}

export function verifyToken(token) {
  if (!jwtSecret) throw new Error('JWT_SECRET is required');
  return jwt.verify(token, jwtSecret);
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    mobile: row.mobile,
    role: row.role,
    entityId: row.entity_id || null,
    preferredContact: row.preferred_contact,
    isActive: row.is_active,
  };
}
