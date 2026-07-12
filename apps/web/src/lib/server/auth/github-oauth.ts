import "server-only";

type GitHubUserResponse = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
};

function getOAuthConfig() {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("Missing GitHub OAuth env. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET in apps/web/.env.local.");
  }

  return { clientId, clientSecret };
}

export function getGitHubAuthorizeUrl(input: { state: string; redirectUri: string; scope: "read:user" | "read:user repo" }) {
  const { clientId } = getOAuthConfig();
  const url = new URL("https://github.com/login/oauth/authorize");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scope);
  url.searchParams.set("state", input.state);

  return url;
}

export async function exchangeGitHubCode(input: { code: string; redirectUri: string }) {
  const { clientId, clientSecret } = getOAuthConfig();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });
  const payload = (await response.json()) as { access_token?: string; error?: string; error_description?: string };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "GitHub OAuth token exchange failed.");
  }

  return payload.access_token;
}

export async function getGitHubUser(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user request failed with ${response.status}.`);
  }

  const user = (await response.json()) as GitHubUserResponse;
  if (!user.id || !user.login) {
    throw new Error("GitHub user response was incomplete.");
  }

  return {
    id: user.id,
    login: user.login,
    name: user.name || null,
    avatarUrl: user.avatar_url || null,
  };
}
