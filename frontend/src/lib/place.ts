// Where the user last was (outside Settings), so feedback opened from Settings can say what it's
// about without asking. Ported from the fit app.

export const PLACES = ["Pantry", "List", "Stock your pantry", "I'm home", "Settings", "Other"] as const;
export type Place = (typeof PLACES)[number];

let last: Place = "Pantry";

/** Called on tab changes; Settings doesn't count (that's where feedback is written). */
export function rememberPlace(place: string): void {
  const match = PLACES.find((p) => p.toLowerCase() === place.toLowerCase());
  if (match && match !== "Settings") last = match;
}

export function lastPlace(): Place {
  return last;
}
