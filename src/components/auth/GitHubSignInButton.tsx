import { signInWithGitHub } from "@/actions/auth";
import { GitHubMark } from "@/components/brand/BrandIcons";
import { Button } from "@/components/ui/button";

interface GitHubSignInButtonProps {
  callbackUrl: string;
  /** "Sign up with GitHub" on the register page; GitHub sign-in creates the account either way. */
  label?: string;
}

export function GitHubSignInButton({
  callbackUrl,
  label = "Sign in with GitHub",
}: Readonly<GitHubSignInButtonProps>) {
  return (
    <form action={signInWithGitHub.bind(null, callbackUrl)}>
      <Button type="submit" variant="outline" className="w-full">
        <GitHubMark />
        {label}
      </Button>
    </form>
  );
}
