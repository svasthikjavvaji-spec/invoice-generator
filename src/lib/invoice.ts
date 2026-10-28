export type LineItem = {
  id: string;
  name: string;
  quantity: string;
  price: string;
};

export type Party = {
  name: string;
  email: string;
  address: string;
};

export type InvoiceData = {
  sender: Party;
  client: Party;
  invoiceNumber: string;
  invoiceDate: string;
  paymentTerms: string;
  items: LineItem[];
  discountPct: string;
  accentColor: string;
  logoDataUrl: string | null;
};

export type CalcResult = {
  subtotal: number;
  discountAmount: number;
  netAfterDiscount: number;
  vat: number;
  total: number;
};

export const VAT_RATE = 0.2;

export function makeId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function emptyItem(): LineItem {
  return { id: makeId(), name: '', quantity: '1', price: '0' };
}

export function lineTotal(it: LineItem): number {
  return (parseFloat(it.quantity) || 0) * (parseFloat(it.price) || 0);
}

export function calculate(data: Pick<InvoiceData, 'items' | 'discountPct'>): CalcResult {
  let subtotal = 0;
  for (const it of data.items) {
    subtotal += lineTotal(it);
  }
  const discountPct = clampPct(parseFloat(data.discountPct) || 0);
  const discountAmount = subtotal * (discountPct / 100);
  const netAfterDiscount = subtotal - discountAmount;
  const vat = netAfterDiscount * VAT_RATE;
  const total = netAfterDiscount + vat;
  return { subtotal, discountAmount, netAfterDiscount, vat, total };
}

export function clampPct(v: number): number {
  if (isNaN(v) || v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

export function formatGBP(value: number): string {
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function niceDate(iso: string): string {
  if (!iso)
    return new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return { r: 16, g: 185, b: 129 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function readableTextOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

export function validateLogo(file: File): { ok: boolean; error?: string } {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: 'Logo must be a PNG, JPG, WEBP or GIF image.' };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: 'Logo file must be 2 MB or smaller.' };
  }
  return { ok: true };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}
