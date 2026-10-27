import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
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
} from 'lucide-react';

type LineItem = {
  id: string;
  name: string;
  quantity: string;
  price: string;
};

function makeId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

const VAT_RATE = 0.2;

function formatGBP(value: number): string {
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function niceDate(iso: string): string {
  if (!iso) return new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

const emptyItem = (): LineItem => ({
  id: makeId(),
  name: '',
  quantity: '1',
  price: '0',
});

export default function InvoiceGenerator() {
  const [sender, setSender] = useState({
    name: '',
    email: '',
    address: '',
  });
  const [client, setClient] = useState({
    name: '',
    email: '',
    address: '',
  });
  const [invoiceNumber, setInvoiceNumber] = useState('INV-0001');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [paymentTerms, setPaymentTerms] = useState('Payment due within 14 days. Thank you for your business.');
  const [items, setItems] = useState<LineItem[]>([
    { id: makeId(), name: '', quantity: '1', price: '0' },
    { id: makeId(), name: '', quantity: '1', price: '0' },
  ]);

  const calc = useMemo(() => {
    let subtotal = 0;
    for (const it of items) {
      const qty = parseFloat(it.quantity) || 0;
      const price = parseFloat(it.price) || 0;
      subtotal += qty * price;
    }
    const vat = subtotal * VAT_RATE;
    const total = subtotal + vat;
    return { subtotal, vat, total };
  }, [items]);

  function updateItem(id: string, field: keyof Omit<LineItem, 'id'>, value: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  function lineTotal(it: LineItem): number {
    return (parseFloat(it.quantity) || 0) * (parseFloat(it.price) || 0);
  }

  function downloadPDF() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Header band
    doc.setFillColor(15, 15, 15);
    doc.rect(0, 0, pageW, 90, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('INVOICE', margin, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 180);
    doc.text(invoiceNumber || 'INV-0001', margin, 60);

    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text('Date: ' + niceDate(invoiceDate), pageW - margin, 42, { align: 'right' });
    doc.text('VAT: GB 20%', pageW - margin, 60, { align: 'right' });

    y = 120;
    doc.setTextColor(20, 20, 20);

    // From / To columns
    const colW = contentW / 2 - 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('FROM', margin, y);
    doc.text('BILL TO', margin + colW + 20, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    const senderLines = [sender.name, sender.email, sender.address].filter(Boolean);
    const clientLines = [client.name, client.email, client.address].filter(Boolean);
    let rowY = y + 16;
    senderLines.forEach((line) => {
      doc.text(line, margin, rowY);
      rowY += 15;
    });
    let rowY2 = y + 16;
    clientLines.forEach((line) => {
      doc.text(line, margin + colW + 20, rowY2);
      rowY2 += 15;
    });
    y = Math.max(rowY, rowY2) + 24;

    // Items table header
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, contentW, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const nameX = margin + 8;
    const qtyX = margin + contentW * 0.55;
    const priceX = margin + contentW * 0.72;
    const totalX = margin + contentW - 8;
    doc.text('DESCRIPTION', nameX, y + 16);
    doc.text('QTY', qtyX, y + 16);
    doc.text('PRICE', priceX, y + 16, { align: 'right' });
    doc.text('AMOUNT', totalX, y + 16, { align: 'right' });
    y += 24;

    // Items rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    const rowH = 22;
    items.forEach((it, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, contentW, rowH, 'F');
      }
      const label = it.name || 'Item';
      const qty = it.quantity || '0';
      const price = parseFloat(it.price) || 0;
      doc.text(label, nameX, y + 15);
      doc.text(qty, qtyX, y + 15);
      doc.text(formatGBP(price), priceX, y + 15, { align: 'right' });
      doc.text(formatGBP(lineTotal(it)), totalX, y + 15, { align: 'right' });
      y += rowH;
      if (y > doc.internal.pageSize.getHeight() - 160) {
        doc.addPage();
        y = margin;
      }
    });

    // Line under table
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, margin + contentW, y);
    y += 16;

    // Totals box (right aligned)
    const totalsW = 220;
    const totalsX = margin + contentW - totalsW;
    const labelX = totalsX;
    const valueX = margin + contentW;
    const rowGap = 20;

    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text('Subtotal', labelX, y);
    doc.setTextColor(30, 30, 30);
    doc.text(formatGBP(calc.subtotal), valueX, y, { align: 'right' });
    y += rowGap;

    doc.setTextColor(90, 90, 90);
    doc.text('VAT (20%)', labelX, y);
    doc.setTextColor(30, 30, 30);
    doc.text(formatGBP(calc.vat), valueX, y, { align: 'right' });
    y += rowGap;

    // Total row
    doc.setFillColor(15, 15, 15);
    doc.rect(totalsX - 12, y - 14, totalsW + 12, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL', labelX, y + 4);
    doc.text(formatGBP(calc.total), valueX, y + 4, { align: 'right' });
    y += 48;

    // Footer note
    if (y < doc.internal.pageSize.getHeight() - 60) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(paymentTerms, margin, y);
    }

    // Footer line
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, doc.internal.pageSize.getHeight() - 36, pageW - margin, doc.internal.pageSize.getHeight() - 36);
    doc.setFontSize(8);
    doc.setTextColor(170, 170, 170);
    doc.text('Generated with Invoice Generator', pageW / 2, doc.internal.pageSize.getHeight() - 22, { align: 'center' });

    doc.save(`${invoiceNumber || 'invoice'}.pdf`);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Ambient background accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 shadow-lg shadow-emerald-500/20">
              <Receipt className="h-6 w-6 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Invoice Generator</h1>
              <p className="text-sm text-white/50">Premium invoicing · UK VAT (20%)</p>
            </div>
          </div>
        </header>

        {/* Top inputs grid */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Sender */}
          <Panel icon={<User className="h-4 w-4" />} title="Sender Details">
            <Field label="Name" value={sender.name} onChange={(v) => setSender({ ...sender, name: v })} placeholder="Your business name" />
            <Field label="Email" value={sender.email} onChange={(v) => setSender({ ...sender, email: v })} placeholder="you@company.com" />
            <Field label="Address" value={sender.address} onChange={(v) => setSender({ ...sender, address: v })} placeholder="Street, City, Postcode" textarea />
          </Panel>

          {/* Client */}
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

        {/* Items table */}
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
                className="grid grid-cols-12 items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-2 transition-colors hover:border-white/10"
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

        {/* Totals */}
        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
            <Calculator className="h-4 w-4 text-sky-400" />
            Summary
          </div>
          <div className="ml-auto max-w-sm space-y-3">
            <Row label="Subtotal" value={formatGBP(calc.subtotal)} />
            <Row label="VAT (20%)" value={formatGBP(calc.vat)} muted />
            <div className="h-px bg-white/10" />
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-400/10 to-sky-400/10 px-4 py-3.5">
              <span className="text-base font-semibold tracking-tight">Total Due</span>
              <span className="text-2xl font-bold tracking-tight text-emerald-300">{formatGBP(calc.total)}</span>
            </div>
          </div>
        </section>

        {/* Download button (mobile + repeat) */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={downloadPDF}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black shadow-xl shadow-white/10 transition-all hover:scale-[1.01] hover:shadow-white/20 active:scale-[0.99] sm:w-auto sm:px-10"
          >
            <Download className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />
            Download Invoice PDF
          </button>
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
