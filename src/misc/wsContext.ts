import { EntityManager } from "@mikro-orm/mongodb";
import { Context } from "graphql-ws";
import { Extra } from "graphql-ws/lib/use/ws";
import { MyContext } from "../types";
import {
  parseCookieHeader,
  resolveUserIdFromTokens,
} from "../middlewares/userAuth";
import { isValidDeviceChannelId } from "./ai/streamSessionOwnership";

type ConnectionParams = {
  accessToken?: string;
  refreshToken?: string;
  deviceId?: string;
};

function asParams(payload: unknown): ConnectionParams {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  return {
    accessToken: typeof p.accessToken === "string" ? p.accessToken : undefined,
    refreshToken:
      typeof p.refreshToken === "string" ? p.refreshToken : undefined,
    deviceId: typeof p.deviceId === "string" ? p.deviceId : undefined,
  };
}

/**
 * Build GraphQL context for graphql-ws connections.
 * Auth from Cookie header and/or connectionParams tokens.
 */
export async function buildWsContext(
  ctx: Context<Record<string, unknown> | undefined, Extra>,
  em: EntityManager
): Promise<MyContext> {
  const params = asParams(ctx.connectionParams);
  const headerCookies = parseCookieHeader(
    ctx.extra.request.headers.cookie
  );

  const accessToken =
    params.accessToken || headerCookies["access-token"];
  const refreshToken =
    params.refreshToken || headerCookies["refresh-token"];

  const userId = await resolveUserIdFromTokens({
    accessToken,
    refreshToken,
    em,
    // WS cannot set cookies on the browser; verify-only (no rotation).
  });

  const deviceId = isValidDeviceChannelId(params.deviceId)
    ? params.deviceId!.trim()
    : undefined;

  const request = {
    userId,
    cookies: {
      "access-token": accessToken,
      "refresh-token": refreshToken,
    },
    headers: ctx.extra.request.headers as Record<
      string,
      string | string[] | undefined
    >,
  };

  return {
    request,
    reply: {
      cookie: () => undefined,
      clearCookie: () => undefined,
    },
    em,
    userId,
    deviceId,
  };
}
