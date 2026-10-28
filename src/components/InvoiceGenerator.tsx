import { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Trash2,
  Download,
  FileText,
  User,
  Building2,
  Hash,
  Calendar,
  Calculator,
  Receipt,
  CreditCard,
  Palette,
  Image as ImageIcon,
  Check,
  AlertCircle,
  X,
  Eye,
} from 'lucide-react';
import {
  InvoiceData,
  LineItem,
  emptyItem,
  makeId,
  calculate,
  formatGBP,
  todayISO,
  lineTotal,
  clampPct,
  validateLogo,
  fileToDataUrl,
  readableTextOn,
} from '@/lib/invoice';
import { generateInvoicePdf } from '@/lib/pdf';
import InvoicePreview from '@/components/InvoicePreview';

const ACCENT_PRESETS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#6366f1', '#111827'];

export default function InvoiceGenerator() {
  const [sender, setSender] = useState({ name: '', email: '', address: '' });
  const [client, setClient] = useState({ name: '', email: '', address: '' });
  const [invoiceNumber, setInvoiceNumber] = useState('INV-0001');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [paymentTerms, setPaymentTerms] = useState(
    'Payment due within 14 days. Thank you for your business.'
  );
  const [discountPct, setDiscountPct] = useState('0');
  const [accentColor, setAccentColor] = useState('#10b981');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [items, setItems] = useState<LineItem[]>([
    { id: makeId(), name: '', quantity: '1', price: '0' },
    { id: makeId(), name: '', quantity: '1', price: '0' },
  ]);
  const [downloaded, setDownloaded] = useState(false);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const data: InvoiceData = {
    sender,
    client,
    invoiceNumber,
    invoiceDate,
    paymentTerms,
    items,
    discountPct,
    accentColor,
    logoDataUrl,
  };

  const calc = useMemo(() => calculate(data), [items, discountPct]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!sender.name.trim()) errors.push('Add a sender name.');
    if (!client.name.trim()) errors.push('Add a client name.');
    const hasAnyItem = items.some((it) => it.name.trim() && (parseFloat(it.price) || 0) > 0);
    if (!hasAnyItem) errors.push('Add at least one item with a name and price.');
    return errors;
  }, [sender.name, client.name, items]);

  function updateItem(id: string, field: keyof Omit<LineItem, 'id'>, value: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const result = validateLogo(file);
    if (!result.ok) {
      setLogoError(result.error ?? 'Invalid file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setLogoDataUrl(url);
    } catch {
      setLogoError('Could not read that file. Please try a different image.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeLogo() {
    setLogoDataUrl(null);
    setLogoError(null);
  }

  function downloadPDF() {
    if (validation.length > 0) return;
    generateInvoicePdf(data, `${invoiceNumber || 'invoice'}.pdf`);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 3500);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Ambient background accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 shadow-lg shadow-emerald-500/20">
              <Receipt className="h-6 w-6 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Invoice Generator</h1>
              <p className="text-sm text-white/50">Premium invoicing · UK VAT (20%)</p>
            </div>
          </div>
          <button
            onClick={() => setShowPreviewMobile((s) => !s)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 lg:hidden"
          >
            <Eye className="h-4 w-4" />
            {showPreviewMobile ? 'Edit Invoice' : 'Preview'}
          </button>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(360px,420px)]">
          {/* ---------------- Left: form ---------------- */}
          <div className={showPreviewMobile ? 'hidden lg:block' : 'block'}>
            {/* Branding */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
                <Palette className="h-4 w-4 text-emerald-400" />
                Company Branding
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Logo */}
                <div>
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                    Company Logo (optional)
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      {logoDataUrl ? (
                        <img src={logoDataUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-white/25" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10">
                        Upload
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                      </label>
                      {logoDataUrl && (
                        <button
                          onClick={removeLogo}
                          className="inline-flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-red-400"
                        >
                          <X className="h-3 w-3" /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {logoError && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="h-3.5 w-3.5" /> {logoError}
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-white/30">PNG, JPG, WEBP or GIF · max 2 MB</p>
                </div>

                {/* Accent colour */}
                <div>
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
                    Invoice Accent Colour
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setAccentColor(c)}
                        className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[#0a0a0b] transition-transform hover:scale-110 ${
                          accentColor.toLowerCase() === c.toLowerCase() ? 'ring-white' : 'ring-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Accent ${c}`}
                      />
                    ))}
                    <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-white/20">
                      <span
                        className="block h-full w-full"
                        style={{
                          background:
                            'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #0ea5e9, #6366f1, #ef4444)',
                        }}
                      />
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Custom accent colour"
                      />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/30">
                    Appears on the invoice header, table & totals
                  </p>
                </div>
              </div>
            </section>

            {/* Parties */}
            <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Panel icon={<User className="h-4 w-4" />} title="Sender Details">
                <Field label="Name" value={sender.name} onChange={(v) => setSender({ ...sender, name: v })} placeholder="Your business name" />
                <Field label="Email" value={sender.email} onChange={(v) => setSender({ ...sender, email: v })} placeholder="you@company.com" />
                <Field label="Address" value={sender.address} onChange={(v) => setSender({ ...sender, address: v })} placeholder="Street, City, Postcode" textarea />
              </Panel>
              <Panel icon={<Building2 className="h-4 w-4" />} title="Client Details">
                <Field label="Name" value={client.name} onChange={(v) => setClient({ ...client, name: v })} placeholder="Client name" />
                <Field label="Email" value={client.email} onChange={(v) => setClient({ ...client, email: v })} placeholder="client@email.com" />
                <Field label="Address" value={client.address} onChange={(v) => setClient({ ...client, address: v })} placeholder="Street, City, Postcode" textarea />
              </Panel>
            </section>

            {/* Invoice meta */}
            <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Panel icon={<Hash className="h-4 w-4" />} title="Invoice Number">
                <Field label="Number" value={invoiceNumber} onChange={setInvoiceNumber} placeholder="INV-0001" />
              </Panel>
              <Panel icon={<Calendar className="h-4 w-4" />} title="Invoice Date">
                <Field label="Date" value={invoiceDate} onChange={setInvoiceDate} placeholder="" type="date" />
              </Panel>
              <Panel icon={<CreditCard className="h-4 w-4" />} title="Payment Terms">
                <PaymentTermsField value={paymentTerms} onChange={setPaymentTerms} />
              </Panel>
            </section>

            {/* Items */}
            <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  Line Items
                </div>
                <button
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-300 transition-all hover:bg-emerald-400/20 hover:border-emerald-400/50 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              {/* Table header (desktop) */}
              <div className="hidden grid-cols-12 gap-3 px-2 pb-2 text-xs font-medium uppercase tracking-wider text-white/40 sm:grid">
                <div className="col-span-6">Item Name</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-right">Price (GBP)</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              <div className="space-y-2">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-12 items-center gap-2 rounded-xl border border-white/5 bg-black/30 p-2 transition-colors hover:border-white/10 sm:gap-3"
                  >
                    <div className="col-span-12 sm:col-span-6">
                      <input
                        value={it.name}
                        onChange={(e) => updateItem(it.id, 'name', e.target.value)}
                        placeholder="Item name or description"
                        className="w-full rounded-lg bg-transparent px-2 py-2 text-sm text-white placeholder-white/30 outline-none focus:bg-white/5"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        value={it.quantity}
                        onChange={(e) => updateItem(it.id, 'quantity', e.target.value)}
                        type="number"
                        min="0"
                        placeholder="1"
                        className="w-full rounded-lg bg-transparent px-2 py-2 text-center text-sm text-white placeholder-white/30 outline-none focus:bg-white/5"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        value={it.price}
                        onChange={(e) => updateItem(it.id, 'price', e.target.value)}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="w-full rounded-lg bg-transparent px-2 py-2 text-right text-sm text-white placeholder-white/30 outline-none focus:bg-white/5"
                      />
                    </div>
                    <div className="col-span-3 flex items-center justify-end text-sm font-medium text-white/70 sm:col-span-2">
                      {formatGBP(lineTotal(it))}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => removeItem(it.id)}
                        disabled={items.length === 1}
                        className="rounded-lg p-2 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-20"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {items.length === 0 && (
                <p className="py-6 text-center text-sm text-white/40">No items yet. Click "Add Item" to begin.</p>
              )}
            </section>

            {/* Discount + Totals */}
            <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr]">
              <Panel icon={<Calculator className="h-4 w-4" />} title="Discount">
                <Field
                  label="Discount %"
                  value={discountPct}
                  onChange={(v) => setDiscountPct(String(clampPct(parseFloat(v) || 0)))}
                  placeholder="0"
                  type="number"
                />
              </Panel>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Calculator className="h-4 w-4 text-sky-400" />
                  Summary
                </div>
                <div className="ml-auto max-w-sm space-y-3">
                  <Row label="Subtotal" value={formatGBP(calc.subtotal)} />
                  {calc.discountAmount > 0 && (
                    <Row label={`Discount (${discountPct || 0}%)`} value={'-' + formatGBP(calc.discountAmount)} muted />
                  )}
                  <Row label="VAT (20%)" value={formatGBP(calc.vat)} muted />
                  <div className="h-px bg-white/10" />
                  <div
                    className="flex items-center justify-between rounded-xl px-4 py-3.5"
                    style={{ backgroundColor: accentColor, color: readableTextOn(accentColor) }}
                  >
                    <span className="text-base font-semibold tracking-tight">Total Due</span>
                    <span className="text-2xl font-bold tracking-tight">{formatGBP(calc.total)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Validation + Download */}
            <div className="mt-6">
              {validation.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-300">
                    <AlertCircle className="h-4 w-4" /> Please fix before downloading:
                  </p>
                  <ul className="ml-5 list-disc text-xs text-amber-200/80">
                    {validation.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-center">
                <button
                  onClick={downloadPDF}
                  disabled={validation.length > 0}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black shadow-xl shadow-white/10 transition-all hover:scale-[1.01] hover:shadow-white/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:w-auto sm:px-10"
                >
                  {downloaded ? <Check className="h-5 w-5 text-emerald-600" /> : <Download className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />}
                  {downloaded ? 'Downloaded!' : 'Download Invoice PDF'}
                </button>
              </div>
              {downloaded && (
                <p className="mt-3 text-center text-sm text-emerald-300">
                  Your invoice has been downloaded. Check your downloads folder.
                </p>
              )}
            </div>
          </div>

          {/* ---------------- Right: live preview ---------------- */}
          <aside className={showPreviewMobile ? 'block' : 'hidden lg:block'}>
            <div className="sticky top-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/60">
                <Eye className="h-4 w-4" />
                Live Preview
              </div>
              <div className="max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-3 sm:p-4">
                <InvoicePreview data={data} />
              </div>
            </div>
          </aside>
        </div>

        <footer className="mt-10 text-center text-xs text-white/30">
          Built for UK businesses · 20% VAT included
        </footer>
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition-colors hover:border-white/15 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
        <span className="text-emerald-400">{icon}</span>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-emerald-400/50 focus:bg-black/50"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-emerald-400/50 focus:bg-black/50 [color-scheme:dark]"
        />
      )}
    </label>
  );
}

function PaymentTermsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const presets = [
    'Payment due within 7 days. Thank you for your business.',
    'Payment due within 14 days. Thank you for your business.',
    'Payment due within 30 days. Thank you for your business.',
    'Payment due on receipt. Thank you for your business.',
  ];
  const isPreset = presets.includes(value);

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Terms</span>
      <select
        value={isPreset ? value : '__custom'}
        onChange={(e) => {
          if (e.target.value !== '__custom') onChange(e.target.value);
        }}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-emerald-400/50 focus:bg-black/50 [color-scheme:dark]"
      >
        {presets.map((p) => (
          <option key={p} value={p} className="bg-[#0a0a0b]">
            {p.replace('. Thank you for your business.', '')}
          </option>
        ))}
        <option value="__custom" className="bg-[#0a0a0b]">
          Custom text...
        </option>
      </select>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter custom payment terms..."
        rows={2}
        className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors focus:border-emerald-400/50 focus:bg-black/50"
      />
    </label>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/60">{label}</span>
      <span className={muted ? 'text-white/70' : 'font-medium text-white'}>{value}</span>
    </div>
  );
}
