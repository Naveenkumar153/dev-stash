"use client";

import { FavoriteToggle } from "@/components/favorites/FavoriteToggle";

interface FavoriteCollectionButtonProps {
  collectionId: string;
  name: string;
  isFavorite: boolean;
}

/** The collection page's Favorite button: an outlined star beside Edit and Delete. */
export function FavoriteCollectionButton({
  collectionId,
  name,
  isFavorite,
}: Readonly<FavoriteCollectionButtonProps>) {
  return (
    <FavoriteToggle
      kind="collection"
      id={collectionId}
      name={name}
      isFavorite={isFavorite}
      variant="outline"
      size="icon"
    />
  );
}
