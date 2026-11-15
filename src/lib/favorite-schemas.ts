import { z } from "zod";

/**
 * The favorite state to save. The toggles send the state they want rather than
 * asking to flip it, so a double click or two tabs can't invert each other.
 */
export const isFavoriteSchema = z.boolean();
