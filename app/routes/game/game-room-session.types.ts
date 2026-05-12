export interface MayINotificationState {
  callerId: string;
  callerName: string;
  cardText: string;
  outcome?: "allowed" | "blocked";
  expiresAt: number | null;
}
