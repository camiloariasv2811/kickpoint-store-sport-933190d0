export function money(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return `$${n.toFixed(2).replace(/\.00$/, "")}`;
}

export function moneyExact(value: number | null | undefined) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export const OFFICIAL_WHATSAPP_NUMBER = "584121546698";
export const OFFICIAL_WHATSAPP_DISPLAY = "+58 412 1546698";

export function cleanPhoneForWhatsApp(phone?: string | null): string {
  if (!phone) return OFFICIAL_WHATSAPP_NUMBER;
  // Remove all non-digit characters (+, spaces, hyphens, parentheses, etc.)
  let digits = phone.replace(/\D/g, "");
  if (!digits) return OFFICIAL_WHATSAPP_NUMBER;

  // Filter out any legacy dummy/sample numbers
  if (
    digits === "584121234567" ||
    digits === "04121234567" ||
    digits === "4121234567" ||
    digits === "12345678" ||
    digits === "584125557890" ||
    digits === "04125557890"
  ) {
    return OFFICIAL_WHATSAPP_NUMBER;
  }

  // If starts with 0412, 0414, 0424, 0416, 0426 (11 digits starting with 0), replace leading 0 with 58
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `58${digits.slice(1)}`;
  } else if (
    digits.length === 10 &&
    (digits.startsWith("412") ||
      digits.startsWith("414") ||
      digits.startsWith("424") ||
      digits.startsWith("416") ||
      digits.startsWith("426"))
  ) {
    digits = `58${digits}`;
  } else if (digits.startsWith("580") && digits.length === 13) {
    digits = `58${digits.slice(3)}`;
  }

  return digits;
}

export function whatsappLink(message: string, phone?: string | null) {
  const sanitizedPhone = cleanPhoneForWhatsApp(phone);
  return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
}
