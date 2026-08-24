import type { Companion, Tour } from "@/types/domain";

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

export function calculateTotal(companions: Companion[], tour: Tour): number {
  return companions.reduce((sum, companion) => {
    return sum + (companion.type === "adult" ? tour.adultPrice : tour.childPrice);
  }, 0);
}
