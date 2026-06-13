import type { Request, Response } from 'express';
import { runAuthorize, exchangeToken, getUserinfo } from './oauth.service';

export const authorize = (req: Request, res: Response) => runAuthorize(req, res);

export const token = (req: Request, res: Response) => exchangeToken(req, res);

export const userinfo = (req: Request, res: Response) => getUserinfo(req, res);
