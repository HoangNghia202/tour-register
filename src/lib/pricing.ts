import type { Companion, PickupPoint, RouteKey, TransportMethod } from "@/types/domain";

export function classifyAge(dob: string): "adult" | "child" {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age < 10 ? "child" : "adult";
}

export function countAdults(companions: Companion[]): number {
  return companions.filter((companion) => companion.type === "adult").length;
}

export function resolveRouteKey(
  transportMethod: TransportMethod,
  pickupPoint: PickupPoint | null,
): RouteKey | null {
  if (transportMethod === "self") return "self";
  return pickupPoint;
}

// Employee + each adult companion pays the route price; children are free.
export function calculateTotal(routePrice: number, adultCount: number): number {
  return routePrice * (1 + adultCount);
}
