import { HomeTemplate } from "@/features/home/templates/HomeTemplate";
import { requireOwnerPageAuth } from "@/lib/server/auth/owner-session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireOwnerPageAuth("/settings");

  return (
    <HomeTemplate
      view="settings"
      user={{ login: user.githubLogin || user.username, name: user.githubName || user.displayName || user.username, avatarUrl: user.githubAvatarUrl, role: user.role }}
    />
  );
}
