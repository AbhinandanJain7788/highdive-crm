export type AgentCallTimeStats = {
  userId: string;
  userName: string;
  todaySeconds: number;
  monthSeconds: number;
  allTimeSeconds: number;
  callCount: number;
  talkSeconds: number;
};

export type IdleCheckResult = {
  checked: number;
  notificationsSent: number;
};
