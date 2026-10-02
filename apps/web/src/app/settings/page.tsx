import { HomeTemplate } from "@/features/home/templates/HomeTemplate";
import { getSketchblockDeploymentEnvironment } from "@/lib/server/auth/auth-mode";
import { requireOwnerPageAuth } from "@/lib/server/auth/owner-session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireOwnerPageAuth("/settings");

  return (
    <HomeTemplate
      deploymentEnvironment={getSketchblockDeploymentEnvironment()}
      view="settings"
      user={{ login: user.githubLogin || user.username, name: user.githubName || user.displayName || user.username, avatarUrl: user.githubAvatarUrl, role: user.role }}
    />
  );
}
