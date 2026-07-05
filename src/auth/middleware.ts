import type { NextFunction, Request, RequestHandler, Response } from "express";
import { isLocalRequest } from "../http/local.js";
import type { PrivateOAuthServer } from "./oauth.js";

export function createMcpAuthMiddleware(options: {
  devAuthBypass: boolean;
  oauthServer: PrivateOAuthServer;
}): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (options.devAuthBypass && isLocalRequest(req)) {
      next();
      return;
    }

    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      sendUnauthorized(
        res,
        options.oauthServer.protectedResourceMetadataUrl(),
        "Missing bearer token",
      );
      return;
    }

    options.oauthServer
      .verifyAccessToken(token)
      .then((authInfo) => {
        req.auth = authInfo;
        next();
      })
      .catch(() => {
        sendUnauthorized(
          res,
          options.oauthServer.protectedResourceMetadataUrl(),
          "Invalid bearer token",
        );
      });
  };
}

function sendUnauthorized(res: Response, resourceMetadataUrl: string, description: string): void {
  res.setHeader(
    "WWW-Authenticate",
    `Bearer error="invalid_token", error_description="${description}", resource_metadata="${resourceMetadataUrl}"`,
  );
  res.status(401).json({ error: "invalid_token", error_description: description });
}
