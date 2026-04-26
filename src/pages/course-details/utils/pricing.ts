import type { Course } from "@/types/courses";

export interface CoursePricing {
  base: number;
  promo: number;
  promoActive: boolean;
  endsAt: number;
  display: number;
}

export function computePricing(
  course?: Pick<Course, "price_vnd" | "promo_price_vnd" | "promo_ends_at"> | null,
): CoursePricing {
  const base = Number(course?.price_vnd || 0);
  const promo = Number(course?.promo_price_vnd || 0);
  const endsAt = course?.promo_ends_at ? Date.parse(course.promo_ends_at) : NaN;
  const promoActive =
    promo > 0 &&
    promo < base &&
    (!Number.isFinite(endsAt) || Date.now() <= endsAt);
  return {
    base,
    promo,
    promoActive,
    endsAt,
    display: promoActive ? promo : base,
  };
}
