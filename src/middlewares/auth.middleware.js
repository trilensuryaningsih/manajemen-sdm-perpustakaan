const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).send({ message: 'No token' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).send({ message: 'Invalid token' });
  }
};

const permit = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).send({ message: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).send({ message: 'Forbidden' });
    next();
  };
};

module.exports = { auth, permit };
