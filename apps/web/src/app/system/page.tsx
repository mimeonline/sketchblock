import { HomeTemplate } from "@/features/home/templates/HomeTemplate";
import { requireInstanceOwnerPageAuth } from "@/lib/server/auth/owner-session";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const user = await requireInstanceOwnerPageAuth("/system");

  return (
    <HomeTemplate
      view="system"
      user={{ login: user.githubLogin || user.username, name: user.githubName || user.displayName || user.username, avatarUrl: user.githubAvatarUrl, role: user.role }}
    />
  );
}
