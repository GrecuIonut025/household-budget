export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** one-time value to show the user (e.g. an invite link) */
  secret?: string;
}
