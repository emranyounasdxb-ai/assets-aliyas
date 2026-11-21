import { z } from "zod";
export const uuid = z.uuid();
export const text = (max = 160) => z.string().trim().min(1).max(max);
export const optionalText = (max = 160) =>
  z.string().trim().max(max).default("");
export const date = z.iso.date();
export const amount = z
  .string()
  .trim()
  .regex(
    /^\d{1,8}(?:\.\d{1,2})?$/,
    "Use a positive amount with up to two decimal places",
  )
  .transform((v) => {
    const [whole, fraction = ""] = v.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  });
export const signedAmount = z
  .string()
  .trim()
  .regex(/^-?\d{1,8}(?:\.\d{1,2})?$/)
  .transform((v) => {
    const negative = v.startsWith("-");
    const [whole, fraction = ""] = v.replace("-", "").split(".");
    return (
      (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
      (negative ? -1 : 1)
    );
  });
export const amenities = z.array(text(80)).max(20).default([]);
