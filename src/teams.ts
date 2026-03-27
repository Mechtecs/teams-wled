import { EventEmitter } from "events";
import fs from "fs/promises";
import path from "path";
import WebSocket from "ws";
import { logger } from "./logger";
import type { MeetingUpdate, TeamsAction, TeamsClientEvents, TeamsMessage } from "./models";

const TEAMS_WS_URL = process.env.TEAMS_WS_URL ?? "ws://localhost:8124";
const TOKEN_PATH = path.resolve(".teams-token");

interface PendingRequest {
  resolve: (response: string) => void;
  reject: (err: Error) => void;
}

export class TeamsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private token: string | null = null;
  private paired = false;
  private pairingRequested = false;
  private pendingRequests = new Map<number, PendingRequest>();

  on<E extends keyof TeamsClientEvents>(event: E, listener: TeamsClientEvents[E]): this {
    return super.on(event, listener);
  }

  emit<E extends keyof TeamsClientEvents>(event: E, ...args: Parameters<TeamsClientEvents[E]>): boolean {
    return super.emit(event, ...args);
  }

  connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      this.token = await this.loadToken();

      const params = new URLSearchParams({
        "protocol-version": "2.0.0",
        manufacturer: "schorradt",
        device: "StatusApp",
        app: "MS-Teams-Websocket",
        "app-version": "1.0",
      });
      if (this.token) {
        params.set("token", this.token);
        logger.info("Connecting with stored token");
      } else {
        logger.info("Connecting without token (pairing required)");
      }
      const url = `${TEAMS_WS_URL}?${params}`;
      const ws = new WebSocket(url);

      ws.on("open", () => {
        logger.info(`Connected to Teams API at ${TEAMS_WS_URL}`);
        this.ws = ws;
        resolve();
      });

      ws.on("message", (data) => {
        const raw = data.toString();
        logger.debug(`Received: ${raw}`);
        const msg: TeamsMessage = JSON.parse(raw);
        this.handleMessage(msg);
      });

      ws.on("close", (code) => {
        logger.info(`Disconnected from Teams API (code ${code})`);
        this.ws = null;
        this.paired = false;
        this.pairingRequested = false;
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error(`Disconnected (code ${code})`));
          this.pendingRequests.delete(id);
        }
        this.emit("disconnected", code);
      });

      ws.on("error", (err) => {
        logger.error(`WebSocket error: ${err.message}`);
        this.emit("error", err);
        reject(err);
      });
    });
  }

  private handleMessage(msg: TeamsMessage): void {
    // Connection acknowledgement
    if (msg.requestId === 0 && msg.response === "Success") {
      logger.info("Connection acknowledged by Teams");
      this.emit("connected");
      return;
    }

    // Response to a sent request
    if (msg.requestId !== undefined && msg.requestId > 0) {
      const pending = this.pendingRequests.get(msg.requestId);
      if (pending) {
        this.pendingRequests.delete(msg.requestId);
        if (msg.errorMsg) {
          pending.reject(new Error(msg.errorMsg));
        } else {
          pending.resolve(msg.response ?? "");
        }
        return;
      }
    }

    if (msg.errorMsg) {
      logger.error(`Teams error: ${msg.errorMsg}`);
      return;
    }

    if (msg.tokenRefresh) {
      this.paired = true;
      this.token = msg.tokenRefresh;
      this.saveToken(msg.tokenRefresh);
      logger.info("Pairing successful, token saved");
      this.emit("tokenRefresh", msg.tokenRefresh);
      return;
    }

    if (msg.meetingUpdate) {
      if (!this.paired && !this.pairingRequested && msg.meetingUpdate.meetingPermissions?.canPair) {
        this.pairingRequested = true;
        logger.info("canPair is true, initiating pairing...");
        this.send("pair");
      }
      this.emit("meetingUpdate", msg.meetingUpdate);
      return;
    }

    logger.warn(`Unknown Teams message: ${JSON.stringify(msg)}`);
  }

  private async loadToken(): Promise<string | null> {
    try {
      const token = (await fs.readFile(TOKEN_PATH, "utf-8")).trim();
      if (token) {
        logger.debug(`Loaded token from ${TOKEN_PATH}`);
        return token;
      }
    } catch {
      // no token file yet
    }
    return null;
  }

  private async saveToken(token: string): Promise<void> {
    await fs.writeFile(TOKEN_PATH, token, "utf-8");
    logger.debug(`Saved token to ${TOKEN_PATH}`);
  }

  send(action: TeamsAction, parameters: Record<string, unknown> = {}): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket is not connected"));
    }
    this.requestId++;
    const id = this.requestId;
    const payload = { action, parameters, requestId: id };
    const raw = JSON.stringify(payload);
    logger.debug(`Sending: ${raw}`);
    this.ws.send(raw);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
    });
  }

  async queryState(): Promise<string> {
    return this.send("query-state");
  }

  close(): void {
    this.ws?.close();
  }
}
