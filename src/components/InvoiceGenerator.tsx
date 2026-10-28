import { useState, useMemo, useRef, useCallback } from 'react';
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
  Save,
  Coins,
  Percent,
} from 'lucide-react';
import {
  InvoiceData,
  LineItem,
  emptyItem,
  makeId,
  calculate,
  formatMoney,
  addDaysISO,
  lineNetCents,
  fromCents,
  parsePct,
  clampPct,
  validateLogo,
  fileToDataUrl,
  readableTextOn,
  CURRENCIES,
  defaultInvoice,
  suggestInvoiceNumber,
  loadSavedInvoices,
  saveInvoiceToStorage,
  deleteInvoiceFromStorage,
  SavedInvoice,
} from '@/lib/invoice';
import { generateInvoicePdf } from '@/lib/pdf';
import InvoicePreview from '@/components/InvoicePreview';
import SavedInvoices, { ConfirmDialog } from '@/components/SavedInvoices';

const ACCENT_PRESETS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#6366f1', '#111827'];

export default function InvoiceGenerator() {
  const [invoice, setInvoice] = useState<InvoiceData>(() => {
    const saved = loadSavedInvoices();
    const fresh = defaultInvoice();
    fresh.invoiceNumber = suggestInvoiceNumber(saved) || fresh.invoiceNumber;
    return fresh;
  });
  const [saved, setSaved] = useState<SavedInvoice[]>(() => loadSavedInvoices());
  const [logoError, setLogoError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pull fields out for convenience
  const {
    sender, client, invoiceNumber, invoiceDate, dueDate, paymentTerms,
    items, discountPct, taxRate, currency, accentColor, logoDataUrl,
  } = invoice;

  const data: InvoiceData = invoice;

  const calc = useMemo(() => calculate(invoice), [invoice]);

  const money = useCallback((v: number) => formatMoney(v, currency), [currency]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (!sender.name.trim()) errors.push('Add a sender name.');
    if (!client.name.trim()) errors.push('Add a client name.');
    if (!invoiceNumber.trim()) errors.push('Add an invoice number.');
    const hasAnyItem = items.some((it) => it.name.trim() && (parseFloat(it.price) || 0) > 0);
    if (!hasAnyItem) errors.push('Add at least one item with a name and price.');
    return errors;
  }, [sender.name, client.name, invoiceNumber, items]);

  /* ---------- Field updaters ---------- */
  function patch<K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) {
    setInvoice((prev) => ({ ...prev, [key]: value }));
  }
  function patchSender(field: keyof InvoiceData['sender'], value: string) {
    setInvoice((prev) => ({ ...prev, sender: { ...prev.sender, [field]: value } }));
  }
  function patchClient(field: keyof InvoiceData['client'], value: string) {
    setInvoice((prev) => ({ ...prev, client: { ...prev.client, [field]: value } }));
  }

  function updateItem(id: string, field: keyof Omit<LineItem, 'id'>, value: string | boolean) {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    }));
  }

  function addItem() {
    setInvoice((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  }

  function removeItem(id: string) {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((it) => it.id !== id) : prev.items,
    }));
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
      patch('logoDataUrl', url);
    } catch {
      setLogoError('Could not read that file. Please try a different image.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeLogo() {
    patch('logoDataUrl', null);
    setLogoError(null);
  }

  /* ---------- Persistence ---------- */
  function refreshSaved() {
    setSaved(loadSavedInvoices());
  }

  function handleSave() {
    saveInvoiceToStorage(invoice);
    refreshSaved();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2500);
  }

  function handleNew() {
    const fresh = defaultInvoice();
    fresh.invoiceNumber = suggestInvoiceNumber(saved) || fresh.invoiceNumber;
    setInvoice(fresh);
    setShowPreviewMobile(false);
  }

  function handleOpen(id: string) {
    const found = saved.find((s) => s.id === id);
    if (!found) return;
    setInvoice(found.data);
    setShowPreviewMobile(false);
  }

  function handleDuplicate(id: string) {
    const found = saved.find((s) => s.id === id);
    if (!found) return;
    const copy: InvoiceData = {
      ...found.data,
      id: makeId(),
      invoiceNumber: suggestInvoiceNumber(saved),
      updatedAt: Date.now(),
    };
    setInvoice(copy);
  }

  function handleDelete(id: string) {
    deleteInvoiceFromStorage(id);
    refreshSaved();
    setConfirmDelete(null);
    // If we deleted the active invoice, start fresh
    if (id === invoice.id) {
      handleNew();
    }
  }

  /* ---------- PDF ---------- */
  function downloadPDF() {
    if (validation.length > 0) return;
    generateInvoicePdf(data, `${invoiceNumber || 'invoice'}.pdf`);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 3500);
  }

  // Sync due date when payment terms preset changes (7/14/30 days)
  function applyTermsPreset(preset: string) {
    patch('paymentTerms', preset);
    const dayMatch = preset.match(/(\d+)\s*days?/i);
    if (dayMatch) {
      const days = parseInt(dayMatch[1], 10);
      patch('dueDate', addDaysISO(invoiceDate, days));
    } else if (/on receipt/i.test(preset)) {
      patch('dueDate', invoiceDate);
    }
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
              <p className="text-sm text-white/50">Premium invoicing · configurable tax & currency</p>
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr_minmax(360px,400px)]">
          {/* ---------------- Left: saved invoices ---------------- */}
          <aside className={showPreviewMobile ? 'hidden lg:block' : 'block'}>
            <div className="sticky top-6 space-y-4">
              <SavedInvoices
                saved={saved}
                activeId={invoice.id}
                onOpen={handleOpen}
                onDuplicate={handleDuplicate}
                onDelete={(id) => setConfirmDelete(id)}
                onNew={handleNew}
              />
            </div>
          </aside>

          {/* ---------------- Center: form ---------------- */}
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
                        <button onClick={removeLogo} className="inline-flex items-center gap-1 text-xs text-white/40 transition-colors hover:text-red-400">
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
                        onClick={() => patch('accentColor', c)}
                        className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[#0a0a0b] transition-transform hover:scale-110 ${
                          accentColor.toLowerCase() === c.toLowerCase() ? 'ring-white' : 'ring-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Accent ${c}`}
                      />
                    ))}
                    <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-white/20">
                      <span className="block h-full w-full" style={{ background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #0ea5e9, #6366f1, #ef4444)' }} />
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => patch('accentColor', e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Custom accent colour"
                      />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/30">Appears on the invoice header, table & totals</p>
                </div>
              </div>
            </section>

            {/* Parties */}
            <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Panel icon={<User className="h-4 w-4" />} title="Sender Details">
                <Field label="Name" value={sender.name} onChange={(v) => patchSender('name', v)} placeholder="Your business name" />
                <Field label="Email" value={sender.email} onChange={(v) => patchSender('email', v)} placeholder="you@company.com" />
                <Field label="Address" value={sender.address} onChange={(v) => patchSender('address', v)} placeholder="Street, City, Postcode" textarea />
              </Panel>
              <Panel icon={<Building2 className="h-4 w-4" />} title="Client Details">
                <Field label="Name" value={client.name} onChange={(v) => patchClient('name', v)} placeholder="Client name" />
                <Field label="Email" value={client.email} onChange={(v) => patchClient('email', v)} placeholder="client@email.com" />
                <Field label="Address" value={client.address} onChange={(v) => patchClient('address', v)} placeholder="Street, City, Postcode" textarea />
              </Panel>
            </section>

            {/* Invoice meta */}
            <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Panel icon={<Hash className="h-4 w-4" />} title="Invoice Number">
                <Field label="Number" value={invoiceNumber} onChange={(v) => patch('invoiceNumber', v)} placeholder="INV-0001" />
              </Panel>
              <Panel icon={<Calendar className="h-4 w-4" />} title="Dates">
                <Field label="Invoice Date" value={invoiceDate} onChange={(v) => patch('invoiceDate', v)} placeholder="" type="date" />
                <Field label="Due Date" value={dueDate} onChange={(v) => patch('dueDate', v)} placeholder="" type="date" />
              </Panel>
              <Panel icon={<CreditCard className="h-4 w-4" />} title="Payment Terms">
                <PaymentTermsField value={paymentTerms} onChange={applyTermsPreset} onTextChange={(v) => patch('paymentTerms', v)} />
              </Panel>
            </section>

            {/* Currency & Tax settings */}
            <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Panel icon={<Coins className="h-4 w-4" />} title="Currency">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">Currency</span>
                  <select
                    value={currency}
                    onChange={(e) => patch('currency', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-emerald-400/50 focus:bg-black/50 [color-scheme:dark]"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-[#0a0a0b]">
                        {c.code} — {c.symbol}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-white/30">No currency conversion is performed. Choose the currency you invoice in.</p>
              </Panel>
              <Panel icon={<Percent className="h-4 w-4" />} title="Tax Rate">
                <Field
                  label="Tax Rate (%)"
                  value={taxRate}
                  onChange={(v) => patch('taxRate', String(clampNonNegative(v)))}
                  placeholder="20"
                  type="number"
                />
                <p className="text-[11px] text-white/30">
                  Default 20% UK VAT. Change to match your region. The app does not determine whether a rate is legally correct.
                </p>
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
              <div className="hidden items-center gap-2 px-2 pb-2 text-xs font-medium uppercase tracking-wider text-white/40 lg:flex">
                <div className="flex-1">Item Name</div>
                <div className="w-16 text-center">Qty</div>
                <div className="w-24 text-right">Price</div>
                <div className="w-16 text-right">Disc %</div>
                <div className="w-20 text-right">Amount</div>
                <div className="w-8"></div>
              </div>

              <div className="space-y-2">
                {items.map((it) => {
                  const itemDisc = parsePct(it.discountPct);
                  const net = fromCents(lineNetCents(it));
                  return (
                    <div
                      key={it.id}
                      className="rounded-xl border border-white/5 bg-black/30 p-2 transition-colors hover:border-white/10"
                    >
                      {/* Row: flex layout that works on all breakpoints */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="order-1 w-full lg:w-auto lg:flex-1">
                          <input
                            value={it.name}
                            onChange={(e) => updateItem(it.id, 'name', e.target.value)}
                            placeholder="Item name or description"
                            className="w-full rounded-lg bg-transparent px-2 py-2 text-sm text-white placeholder-white/30 outline-none focus:bg-white/5"
                          />
                        </div>
                        <div className="order-2 w-16">
                          <input
                            value={it.quantity}
                            onChange={(e) => updateItem(it.id, 'quantity', e.target.value)}
                            type="number"
                            min="0"
                            step="any"
                            placeholder="1"
                            className="w-full rounded-lg bg-transparent px-2 py-2 text-center text-sm text-white placeholder-white/30 outline-none focus:bg-white/5"
                          />
                        </div>
                        <div className="order-3 w-24">
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
                        <div className="order-4 w-16">
                          <input
                            value={it.discountPct}
                            onChange={(e) => updateItem(it.id, 'discountPct', String(clampPct(parseFloat(e.target.value) || 0)))}
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            className="w-full rounded-lg bg-transparent px-2 py-2 text-right text-sm text-white placeholder-white/30 outline-none focus:bg-white/5"
                          />
                        </div>
                        <div className="order-5 w-20 flex items-center justify-end text-sm font-medium text-white/70">
                          {money(net)}
                        </div>
                        <div className="order-6 w-8 flex justify-end">
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
                      {/* Row 2: tax-exempt toggle */}
                      <div className="mt-1 flex items-center gap-3 px-2">
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-white/50">
                          <input
                            type="checkbox"
                            checked={it.taxExempt}
                            onChange={(e) => updateItem(it.id, 'taxExempt', e.target.checked)}
                            className="h-3.5 w-3.5 accent-emerald-400"
                          />
                          Tax-exempt
                        </label>
                        {itemDisc > 0 && (
                          <span className="text-xs text-white/30">{itemDisc}% item discount applied</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {items.length === 0 && (
                <p className="py-6 text-center text-sm text-white/40">No items yet. Click "Add Item" to begin.</p>
              )}
            </section>

            {/* Invoice-level discount + Totals */}
            <section className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr]">
              <Panel icon={<Calculator className="h-4 w-4" />} title="Invoice Discount">
                <Field
                  label="Discount %"
                  value={discountPct}
                  onChange={(v) => patch('discountPct', String(clampPct(parseFloat(v) || 0)))}
                  placeholder="0"
                  type="number"
                />
                <p className="text-[11px] text-white/30">Applied to the subtotal before tax.</p>
              </Panel>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Calculator className="h-4 w-4 text-sky-400" />
                  Summary
                </div>
                <div className="ml-auto max-w-sm space-y-3">
                  <Row label="Subtotal" value={money(calc.subtotal)} />
                  {calc.discountAmount > 0 && (
                    <Row label={`Invoice Discount (${discountPct || 0}%)`} value={'-' + money(calc.discountAmount)} muted />
                  )}
                  <Row label={`Tax (${taxRate || 0}%)`} value={money(calc.tax)} muted />
                  <div className="h-px bg-white/10" />
                  <div
                    className="flex items-center justify-between rounded-xl px-4 py-3.5"
                    style={{ backgroundColor: accentColor, color: readableTextOn(accentColor) }}
                  >
                    <span className="text-base font-semibold tracking-tight">Total Due</span>
                    <span className="text-2xl font-bold tracking-tight">{money(calc.total)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="mt-6 space-y-4">
              {validation.length > 0 && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                  <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-300">
                    <AlertCircle className="h-4 w-4" /> Please fix before downloading:
                  </p>
                  <ul className="ml-5 list-disc text-xs text-amber-200/80">
                    {validation.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={handleSave}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-4 text-base font-semibold text-white transition-all hover:bg-white/10 active:scale-[0.98] sm:px-8"
                >
                  {savedFlash ? <Check className="h-5 w-5 text-emerald-400" /> : <Save className="h-5 w-5" />}
                  {savedFlash ? 'Saved!' : 'Save Draft'}
                </button>
                <button
                  onClick={downloadPDF}
                  disabled={validation.length > 0}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black shadow-xl shadow-white/10 transition-all hover:scale-[1.01] hover:shadow-white/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:px-10"
                >
                  {downloaded ? <Check className="h-5 w-5 text-emerald-600" /> : <Download className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />}
                  {downloaded ? 'Downloaded!' : 'Download Invoice PDF'}
                </button>
              </div>
              {downloaded && (
                <p className="text-center text-sm text-emerald-300">Your invoice has been downloaded. Check your downloads folder.</p>
              )}
              {savedFlash && (
                <p className="text-center text-sm text-emerald-300">Draft saved to this browser.</p>
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
          Built for UK businesses · 20% VAT default · configurable tax & currency
        </footer>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this invoice?"
        message="This permanently removes the saved draft from your browser. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function clampNonNegative(v: string): number {
  const n = parseFloat(v) || 0;
  return isNaN(n) || n < 0 ? 0 : n;
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
  onTextChange,
}: {
  value: string;
  onChange: (v: string) => void;
  onTextChange: (v: string) => void;
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
        <option value="__custom" className="bg-[#0a0a0b]">Custom text...</option>
      </select>
      <textarea
        value={value}
        onChange={(e) => onTextChange(e.target.value)}
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
