import { signInWithGitHub } from "@/actions/auth";
import { GitHubMark } from "@/components/brand/BrandIcons";
import { Button } from "@/components/ui/button";

export function GitHubSignInButton({ callbackUrl }: Readonly<{ callbackUrl: string }>) {
  return (
    <form action={signInWithGitHub.bind(null, callbackUrl)}>
      <Button type="submit" variant="outline" className="w-full">
        <GitHubMark />
        Sign in with GitHub
      </Button>
    </form>
  );
}
