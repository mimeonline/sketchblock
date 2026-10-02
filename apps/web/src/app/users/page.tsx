import { HomeTemplate } from "@/features/home/templates/HomeTemplate";
import { getSketchblockDeploymentEnvironment } from "@/lib/server/auth/auth-mode";
import { requireInstanceOwnerPageAuth } from "@/lib/server/auth/owner-session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requireInstanceOwnerPageAuth("/users");

  return (
    <HomeTemplate
      deploymentEnvironment={getSketchblockDeploymentEnvironment()}
      view="users"
      user={{ login: user.githubLogin || user.username, name: user.githubName || user.displayName || user.username, avatarUrl: user.githubAvatarUrl, role: user.role }}
    />
  );
}
