// ---------------------------------------------------------------------------
// Meeting state & permissions
// ---------------------------------------------------------------------------

/** Current state of the active meeting. Pushed via meetingUpdate. */
export interface MeetingState {
  /** Microphone is muted. */
  isMuted: boolean;
  /** Camera is active. */
  isVideoOn: boolean;
  /** Hand is raised. */
  isHandRaised: boolean;
  /** User is currently in a meeting/call. */
  isInMeeting: boolean;
  /** Meeting is being recorded. */
  isRecordingOn: boolean;
  /** Background blur is enabled. */
  isBackgroundBlurred: boolean;
  /** User is sharing their screen. */
  isSharing: boolean;
  /** Unread chat messages in the meeting. */
  hasUnreadMessages: boolean;
}

/** Permissions indicating which actions are currently allowed. */
export interface MeetingPermissions {
  canReact: boolean;
  canToggleVideo: boolean;
  canToggleMute: boolean;
  canToggleHand: boolean;
  canToggleShareTray: boolean;
  canLeave: boolean;
  canToggleBlur: boolean;
  canToggleChat: boolean;
  canStopSharing: boolean;
  /** True when the user is in a meeting and device pairing can be initiated. */
  canPair: boolean;
}

/** Combined meeting update pushed by Teams on state changes. */
export interface MeetingUpdate {
  meetingState: MeetingState;
  meetingPermissions: MeetingPermissions;
}

// ---------------------------------------------------------------------------
// Teams WebSocket protocol v2.0.0 — actions
// ---------------------------------------------------------------------------

/** Reaction types for the send-reaction action. */
export type ReactionType = "like" | "love" | "applause" | "laugh" | "wow";

/** UI element types for the toggle-ui action. */
export type ToggleUiType = "chat" | "share-tray";

/**
 * All available actions in the Teams WebSocket API v2.0.0.
 *
 * Actions are sent as: { action, parameters, requestId }
 *
 * --- Query ---
 * "query-state"              parameters: {}                     Query the current meeting state. Returns a meetingUpdate.
 *
 * --- Pairing ---
 * "pair"                     parameters: {}                     Initiate device pairing. Teams prompts the user to approve.
 *
 * --- Microphone ---
 * "toggle-mute"              parameters: {}                     Toggle microphone mute.
 * "mute"                     parameters: {}                     Mute microphone.
 * "unmute"                   parameters: {}                     Unmute microphone.
 *
 * --- Camera ---
 * "toggle-video"             parameters: {}                     Toggle camera.
 * "show-video"               parameters: {}                     Turn camera on.
 * "hide-video"               parameters: {}                     Turn camera off.
 *
 * --- Hand ---
 * "toggle-hand"              parameters: {}                     Toggle raised hand.
 * "raise-hand"               parameters: {}                     Raise hand.
 * "lower-hand"               parameters: {}                     Lower hand.
 *
 * --- Background ---
 * "toggle-background-blur"   parameters: {}                     Toggle background blur.
 * "blur-background"          parameters: {}                     Enable background blur.
 * "unblur-background"        parameters: {}                     Disable background blur.
 *
 * --- Call ---
 * "leave-call"               parameters: {}                     Leave the current meeting/call.
 * "stop-sharing"             parameters: {}                     Stop screen sharing.
 *
 * --- Reactions ---
 * "send-reaction"            parameters: { type: ReactionType } Send a reaction (like, love, applause, laugh, wow).
 *
 * --- UI ---
 * "toggle-ui"                parameters: { type: ToggleUiType } Toggle a UI panel (chat, share-tray).
 */
export type TeamsAction =
  | "query-state"
  | "pair"
  | "toggle-mute"
  | "mute"
  | "unmute"
  | "toggle-video"
  | "show-video"
  | "hide-video"
  | "toggle-hand"
  | "raise-hand"
  | "lower-hand"
  | "toggle-background-blur"
  | "blur-background"
  | "unblur-background"
  | "leave-call"
  | "stop-sharing"
  | "send-reaction"
  | "toggle-ui";

// ---------------------------------------------------------------------------
// Wire protocol messages
// ---------------------------------------------------------------------------

/** Message received from the Teams WebSocket server. */
export interface TeamsMessage {
  requestId?: number;
  response?: string;
  errorMsg?: string;
  /** Received after successful pairing. Store this token for reconnection. */
  tokenRefresh?: string;
  meetingUpdate?: MeetingUpdate;
}

/** Events emitted by TeamsClient. */
export interface TeamsClientEvents {
  /** Fired on every meetingUpdate from Teams (initial + subsequent changes). */
  meetingUpdate: (update: MeetingUpdate) => void;
  /** Fired when a new pairing token is received. Token is persisted automatically. */
  tokenRefresh: (token: string) => void;
  /** Fired when the initial connection handshake succeeds (requestId 0). */
  connected: () => void;
  /** Fired when the WebSocket connection closes. */
  disconnected: (code: number) => void;
  /** Fired on WebSocket errors. */
  error: (err: Error) => void;
}
