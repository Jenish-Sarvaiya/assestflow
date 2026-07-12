import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  id: number;
  email: string;
  role: string;
  departmentId: number | null;
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Access token missing' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'assetflow-super-secret-key-hackathon-2026-very-long', (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
      }

      (req as any).user = user as TokenPayload;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: Authorization header missing' });
  }
};
