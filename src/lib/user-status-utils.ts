export function isInvitedLikeStatus(status: unknown): boolean {
  const raw = String(status ?? "").toLowerCase().trim();
  return [
    "invited",
    "pending",
    "invite_pending",
    "invitation_sent",
    "invite",
  ].includes(raw);
}

export function effectiveUserStatus(profile: {
  status?: string;
  last_login_at?: string | null;
  last_activity_at?: string | null;
}): string {
  const status = String(profile.status || "active").toLowerCase();
  if (isInvitedLikeStatus(status)) {
    if (profile.last_login_at || profile.last_activity_at) {
      return "active";
    }
  }
  return status;
}
