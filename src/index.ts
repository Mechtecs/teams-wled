import "dotenv/config";
import { createLogger } from "./logger";

const logger = createLogger("index");
import { TeamsClient } from "./teams";
import { WledClient } from "./wled";

const WLED_PRESET_IDLE = Number(process.env.WLED_PRESET_IDLE ?? 1);
const WLED_PRESET_IN_MEETING = Number(process.env.WLED_PRESET_IN_MEETING ?? 2);
const WLED_PRESET_MUTED = Number(process.env.WLED_PRESET_MUTED ?? 3);
const WLED_PRESET_UNREAD = Number(process.env.WLED_PRESET_UNREAD ?? 4);

async function main() {
  logger.info("teams-wled starting...");

  const teams = new TeamsClient();
  const wled = new WledClient();

  let currentPreset: number | null = null;
  let isInMeeting = false;
  let isMuted = false;
  let hasUnread = false;

  async function updatePreset() {
    let target: number;
    if (isInMeeting && isMuted) {
      target = WLED_PRESET_MUTED;
    } else if (hasUnread) {
      target = WLED_PRESET_UNREAD;
    } else if (isInMeeting) {
      target = WLED_PRESET_IN_MEETING;
    } else {
      target = WLED_PRESET_IDLE;
    }

    if (target === currentPreset) return;
    currentPreset = target;

    if (target === WLED_PRESET_MUTED) {
      logger.info("In meeting (muted)");
    } else if (target === WLED_PRESET_UNREAD) {
      logger.info("Unread messages");
    } else if (target === WLED_PRESET_IN_MEETING) {
      logger.info("In meeting");
    } else {
      logger.info("Idle");
    }
    try {
      await wled.setPreset(target);
    } catch (err) {
      logger.error(`Failed to set WLED preset: ${(err as Error).message}`);
    }
  }

  teams.on("connected", () => {
    teams.queryState();
  });

  teams.on("meetingUpdate", async (update) => {
    logger.debug(`Meeting update: ${JSON.stringify(update, null, 2)}`);

    isInMeeting = update.meetingState?.isInMeeting ?? false;
    isMuted = update.meetingState?.isMuted ?? false;
    hasUnread = update.meetingState?.hasUnreadMessages ?? false;

    await updatePreset();
  });

  teams.on("tokenRefresh", (token) => {
    logger.info(`Received token: ${token}`);
  });

  let shuttingDown = false;

  teams.on("disconnected", (code) => {
    if (shuttingDown) return;
    logger.warn(`Connection lost (${code}), exiting.`);
    process.exit(1);
  });

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Shutting down, resetting WLED to idle...");
    try {
      await wled.setPreset(WLED_PRESET_IDLE);
    } catch (err) {
      logger.error(`Failed to reset WLED: ${(err as Error).message}`);
    }
    teams.close();
    // let the event loop drain cleanly instead of forcing exit
    setTimeout(() => process.exit(0), 500);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await teams.connect();
  logger.info("Ready.");
}

main();
