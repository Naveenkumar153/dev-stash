import { z } from "zod";

/**
 * The state a favorite or pin toggle wants saved. The toggles send the state
 * they want rather than asking to flip it, so a double click or two tabs can't
 * invert each other.
 */
export const wantedStateSchema = z.boolean();
