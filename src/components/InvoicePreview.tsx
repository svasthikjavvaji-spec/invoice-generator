import { InvoiceData, calculate, formatGBP, niceDate, lineTotal, readableTextOn } from '@/lib/invoice';
import { FileText } from 'lucide-react';

export default function InvoicePreview({ data }: { data: InvoiceData }) {
  const calc = calculate(data);
  const accentText = readableTextOn(data.accentColor);
  const accentStyle = { backgroundColor: data.accentColor, color: accentText };

  const senderLines = [data.sender.name, data.sender.email, data.sender.address].filter(Boolean);
  const clientLines = [data.client.name, data.client.email, data.client.address].filter(Boolean);
  const hasItems = data.items.some((it) => it.name || parseFloat(it.price) > 0);

  return (
    <div className="mx-auto w-full max-w-full overflow-hidden rounded-xl bg-white text-[#111] shadow-2xl ring-1 ring-black/10">
      {/* Header band */}
      <div className="flex items-center justify-between px-6 py-5 sm:px-8 sm:py-6" style={accentStyle}>
        <div className="flex items-center gap-3">
          {data.logoDataUrl ? (
            <img
              src={data.logoDataUrl}
              alt="Company logo"
              className="max-h-10 max-w-[160px] object-contain"
            />
          ) : (
            <span className="text-xl font-bold tracking-tight sm:text-2xl">INVOICE</span>
          )}
        </div>
        <div className="text-right text-xs sm:text-sm">
          <div className="font-semibold">{data.invoiceNumber || 'INV-0001'}</div>
          <div className="opacity-80">{niceDate(data.invoiceDate)}</div>
        </div>
      </div>

      {/* From / Bill To */}
      <div className="grid grid-cols-2 gap-4 px-6 pt-6 sm:px-8">
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">From</p>
          {senderLines.length > 0 ? (
            <div className="space-y-0.5 text-xs text-gray-700 sm:text-sm">
              {senderLines.map((l, i) => <p key={i} className="break-words">{l}</p>)}
            </div>
          ) : (
            <p className="text-xs text-gray-300">No sender details</p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Bill To</p>
          {clientLines.length > 0 ? (
            <div className="space-y-0.5 text-xs text-gray-700 sm:text-sm">
              {clientLines.map((l, i) => <p key={i} className="break-words">{l}</p>)}
            </div>
          ) : (
            <p className="text-xs text-gray-300">No client details</p>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="px-6 pt-6 sm:px-8">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr style={accentStyle}>
              <th className="rounded-l px-3 py-2 text-[10px] font-bold uppercase tracking-wider">Description</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider">Qty</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider">Price</th>
              <th className="rounded-r px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {hasItems ? (
              data.items.map((it, idx) => (
                <tr key={it.id} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
                  <td className="border-b border-gray-100 px-3 py-2 text-xs sm:text-sm break-words">
                    {it.name || <span className="text-gray-300">Untitled item</span>}
                  </td>
                  <td className="border-b border-gray-100 px-3 py-2 text-right text-xs sm:text-sm">{it.quantity || '0'}</td>
                  <td className="border-b border-gray-100 px-3 py-2 text-right text-xs sm:text-sm">{formatGBP(parseFloat(it.price) || 0)}</td>
                  <td className="border-b border-gray-100 px-3 py-2 text-right text-xs font-medium sm:text-sm">{formatGBP(lineTotal(it))}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-gray-300">
                  No line items yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end px-6 pb-4 pt-4 sm:px-8">
        <div className="w-full max-w-[260px] space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">{formatGBP(calc.subtotal)}</span>
          </div>
          {calc.discountAmount > 0 && (
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-500">Discount ({data.discountPct || 0}%)</span>
              <span className="font-medium">-{formatGBP(calc.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-gray-500">VAT (20%)</span>
            <span className="font-medium">{formatGBP(calc.vat)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between rounded-lg px-3 py-2.5" style={accentStyle}>
            <span className="text-sm font-bold">Total Due</span>
            <span className="text-base font-bold">{formatGBP(calc.total)}</span>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="border-t border-gray-100 px-6 py-4 sm:px-8">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <FileText className="h-3 w-3" /> Terms
        </div>
        <p className="text-xs text-gray-500 break-words">{data.paymentTerms}</p>
      </div>
    </div>
  );
}
