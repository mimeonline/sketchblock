import { HomeTemplate } from "@/features/home/templates/HomeTemplate";
import { requireOwnerPageAuth } from "@/lib/server/auth/owner-session";

export const dynamic = "force-dynamic";

export default async function RepositoriesPage() {
  const user = await requireOwnerPageAuth("/repositories");

  return (
    <HomeTemplate
      view="repositories"
      user={{ login: user.githubLogin || user.username, name: user.githubName || user.displayName || user.username, avatarUrl: user.githubAvatarUrl, role: user.role }}
    />
  );
}
