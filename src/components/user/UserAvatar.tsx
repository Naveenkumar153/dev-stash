import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarProps {
  name: string;
  image?: string | null;
  size?: React.ComponentProps<typeof Avatar>["size"];
  className?: string;
}

/** "Brad Traversy" -> "BT", "jane" -> "J". */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The user's image (e.g. a GitHub avatar) when there is one, initials
 * otherwise. The initials also show while the image loads or if it fails.
 */
export function UserAvatar({ name, image, size, className }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
