import { HomeTemplate } from "@/features/home/templates/HomeTemplate";
import { requireOwnerPageAuth } from "@/lib/server/auth/owner-session";

export const dynamic = "force-dynamic";

type SessionsPageProps = {
  searchParams: Promise<{
    path?: string;
  }>;
};

export default async function SessionsPage({ searchParams }: SessionsPageProps) {
  const user = await requireOwnerPageAuth("/sessions");
  const { path } = await searchParams;

  return (
    <HomeTemplate
      view="sessions"
      initialPath={path}
      user={{ login: user.githubLogin || user.username, name: user.githubName || user.displayName || user.username, avatarUrl: user.githubAvatarUrl, role: user.role }}
    />
  );
}
