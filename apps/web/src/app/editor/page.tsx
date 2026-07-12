import { HomeTemplate } from "@/features/home/templates/HomeTemplate";
import { requireOwnerPageAuth } from "@/lib/server/auth/owner-session";

export const dynamic = "force-dynamic";

type EditorPageProps = {
  searchParams: Promise<{
    path?: string;
  }>;
};

export default async function EditorPage({ searchParams }: EditorPageProps) {
  const user = await requireOwnerPageAuth("/editor");
  const { path } = await searchParams;

  return (
    <HomeTemplate
      view="editor"
      initialPath={path}
      user={{ login: user.githubLogin || user.username, name: user.githubName || user.displayName || user.username, avatarUrl: user.githubAvatarUrl, role: user.role }}
    />
  );
}
