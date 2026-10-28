export type LineItem = {
  id: string;
  name: string;
  quantity: string;
  price: string;
  discountPct: string;
  taxExempt: boolean;
};

export type Party = {
  name: string;
  email: string;
  address: string;
};

export type Currency = {
  code: string;
  symbol: string;
  locale: string;
};

export type InvoiceData = {
  id: string;
  sender: Party;
  client: Party;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  items: LineItem[];
  discountPct: string;
  taxRate: string;
  currency: string;
  accentColor: string;
  logoDataUrl: string | null;
  updatedAt: number;
};

export type CalcResult = {
  subtotal: number;
  discountAmount: number;
  netAfterDiscount: number;
  tax: number;
  total: number;
};

export const CURRENCIES: Currency[] = [
  { code: 'GBP', symbol: '£', locale: 'en-GB' },
  { code: 'EUR', symbol: '€', locale: 'en-IE' },
  { code: 'USD', symbol: '$', locale: 'en-US' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
  { code: 'CHF', symbol: 'CHF', locale: 'de-CH' },
  { code: 'SEK', symbol: 'kr', locale: 'sv-SE' },
  { code: 'INR', symbol: '₹', locale: 'en-IN' },
  { code: 'CNY', symbol: '¥', locale: 'zh-CN' },
];

export const DEFAULT_TAX_RATE = '20';
export const STORAGE_KEY = 'invoice-generator:drafts';
export const SETTINGS_KEY = 'invoice-generator:settings';

/** Convert a user-typed number to integer cents to avoid floating-point drift. */
export function toCents(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(n) || !isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function emptyItem(): LineItem {
  return { id: makeId(), name: '', quantity: '1', price: '0', discountPct: '0', taxExempt: false };
}

export function defaultInvoice(): InvoiceData {
  return {
    id: makeId(),
    sender: { name: '', email: '', address: '' },
    client: { name: '', email: '', address: '' },
    invoiceNumber: 'INV-0001',
    invoiceDate: todayISO(),
    dueDate: addDaysISO(todayISO(), 14),
    paymentTerms: 'Payment due within 14 days. Thank you for your business.',
    items: [emptyItem(), emptyItem()],
    discountPct: '0',
    taxRate: DEFAULT_TAX_RATE,
    currency: 'GBP',
    accentColor: '#10b981',
    logoDataUrl: null,
    updatedAt: Date.now(),
  };
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return todayISO();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

/** Clamp a percentage 0-100, returning a number. */
export function clampPct(v: number): number {
  if (isNaN(v) || v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

/** Parse a percentage string safely into a clamped number. */
export function parsePct(s: string): number {
  return clampPct(parseFloat(s) || 0);
}

/** Line total in cents, before per-item discount. */
export function lineTotalCents(it: LineItem): number {
  const qty = toCents(it.quantity) / 100;
  const priceCents = toCents(it.price);
  return Math.round(qty * priceCents);
}

/** Line total after the item's own discount. */
export function lineNetCents(it: LineItem): number {
  const gross = lineTotalCents(it);
  const d = parsePct(it.discountPct);
  return Math.round(gross - (gross * d) / 100);
}

export function lineTaxCents(it: LineItem, taxRate: string): number {
  if (it.taxExempt) return 0;
  const rate = parseFloat(taxRate) || 0;
  const net = lineNetCents(it);
  return Math.round((net * rate) / 100);
}

/**
 * Full invoice calculation using integer-cent arithmetic.
 * Subtotal = sum of gross line totals (before any discounts).
 * Discount = invoice-level discount applied to the subtotal.
 * Tax = sum of per-item tax (items can be exempt, each taxed on its own net).
 */
export function calculate(data: Pick<InvoiceData, 'items' | 'discountPct' | 'taxRate'>): CalcResult {
  let subtotalC = 0;
  let taxC = 0;

  for (const it of data.items) {
    const gross = lineTotalCents(it);
    subtotalC += gross;
    taxC += lineTaxCents(it, data.taxRate);
  }

  const invDiscount = parsePct(data.discountPct);
  const discountC = Math.round((subtotalC * invDiscount) / 100);
  const netC = subtotalC - discountC;

  // Tax is computed per-item on each item's net (after item discount).
  // Invoice-level discount reduces the overall taxable base proportionally.
  const discountRatio = subtotalC > 0 ? netC / subtotalC : 1;
  const adjustedTaxC = Math.round(taxC * discountRatio);

  const totalC = netC + adjustedTaxC;

  return {
    subtotal: fromCents(subtotalC),
    discountAmount: fromCents(discountC),
    netAfterDiscount: fromCents(netC),
    tax: fromCents(adjustedTaxC),
    total: fromCents(totalC),
  };
}

export function formatMoney(value: number, currencyCode: string): string {
  const cur = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const isJpy = cur.code === 'JPY';
  try {
    return value.toLocaleString(cur.locale, {
      style: 'currency',
      currency: cur.code,
      minimumFractionDigits: isJpy ? 0 : 2,
      maximumFractionDigits: isJpy ? 0 : 2,
    });
  } catch {
    return `${cur.symbol}${value.toFixed(isJpy ? 0 : 2)}`;
  }
}

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '£';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return { r: 16, g: 185, b: 129 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
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

/* ---------- Persistence (browser localStorage) ---------- */

export type SavedInvoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  currency: string;
  updatedAt: number;
  data: InvoiceData;
};

export function loadSavedInvoices(): SavedInvoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a: SavedInvoice, b: SavedInvoice) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveInvoiceToStorage(data: InvoiceData): void {
  const calc = calculate(data);
  const entry: SavedInvoice = {
    id: data.id,
    invoiceNumber: data.invoiceNumber,
    clientName: data.client.name,
    total: calc.total,
    currency: data.currency,
    updatedAt: Date.now(),
    data: { ...data, updatedAt: Date.now() },
  };
  const all = loadSavedInvoices().filter((s) => s.id !== data.id);
  all.push(entry);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // storage full or unavailable — silently fail
  }
}

export function deleteInvoiceFromStorage(id: string): void {
  const all = loadSavedInvoices().filter((s) => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

/** Generate a sensible next invoice number by scanning saved invoices. */
export function suggestInvoiceNumber(existing: SavedInvoice[]): string {
  const nums = existing
    .map((s) => {
      const m = s.invoiceNumber.match(/(\d+)\s*$/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  const next = max + 1;
  return `INV-${String(next).padStart(4, '0')}`;
}
