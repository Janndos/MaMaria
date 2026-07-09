/** The two — and only two — pickup points. Shared by the checkout UI and the
 *  order-creation endpoint so the allowed set can never drift between them. */
export type PickupLocation = { id: string; name: string; address: string };

export const PICKUP_LOCATIONS: PickupLocation[] = [
  { id: "draxlmaier-1", name: "DRÄXLMAIER 1", address: "Strada Industrială 4" },
  { id: "draxlmaier-2", name: "DRÄXLMAIER 2", address: "Strada Dovator Nr. 86" },
];

export function findLocation(id: string): PickupLocation | undefined {
  return PICKUP_LOCATIONS.find((l) => l.id === id);
}

/** Human label stored as a snapshot on the order ("DRÄXLMAIER 1 · Strada Industrială 4"). */
export function locationLabel(id: string | null | undefined): string {
  const loc = id ? findLocation(id) : undefined;
  return loc ? `${loc.name} · ${loc.address}` : (id ?? "—");
}
