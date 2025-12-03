import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware для проверки JWT токена
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Токен доступа отсутствует' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Недействительный или истекший токен' 
      });
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  });
}

/**
 * Опциональная аутентификация (не блокирует запрос, если токена нет)
 */
export function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
      }
    });
  }

  next();
}

