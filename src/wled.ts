import { logger } from "./logger";

const WLED_URL = process.env.WLED_URL ?? "http://192.168.178.160";

export class WledClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = WLED_URL.replace(/\/+$/, "");
  }

  /** Set a WLED preset by ID. */
  async setPreset(id: number): Promise<void> {
    const url = `${this.baseUrl}/json/state`;
    const body = JSON.stringify({ ps: id });
    logger.debug(`WLED POST ${url} ${body}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      throw new Error(`WLED request failed: ${res.status} ${res.statusText}`);
    }

    logger.info(`WLED preset ${id} activated`);
  }

  /** Get the current WLED state. */
  async getState(): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}/json/state`;
    logger.debug(`WLED GET ${url}`);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`WLED request failed: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<Record<string, unknown>>;
  }
}
