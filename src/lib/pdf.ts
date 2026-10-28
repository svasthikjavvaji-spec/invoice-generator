import jsPDF from 'jspdf';
import {
  InvoiceData,
  CalcResult,
  calculate,
  formatGBP,
  niceDate,
  lineTotal,
  hexToRgb,
  readableTextOn,
} from '@/lib/invoice';

const PAGE_MARGIN = 48;
const FONT = 'helvetica';

type Rgb = { r: number; g: number; b: number };

export function generateInvoicePdf(data: InvoiceData, filename: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - PAGE_MARGIN * 2;

  const accent: Rgb = hexToRgb(data.accentColor);
  const calc = calculate(data);

  let y = PAGE_MARGIN;

  const spaceLeft = () => pageH - PAGE_MARGIN - y;

  function ensureSpace(needed: number) {
    if (spaceLeft() < needed) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  }

  function drawFooterLine(page?: number) {
    const pageNo = page ?? doc.getCurrentPageInfo().pageNumber;
    doc.setPage(pageNo);
    doc.setDrawColor(225, 225, 225);
    doc.line(PAGE_MARGIN, pageH - 36, pageW - PAGE_MARGIN, pageH - 36);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(170, 170, 170);
    doc.text('Generated with Invoice Generator', pageW / 2, pageH - 22, { align: 'center' });
  }

  /* ---------- Header ---------- */
  const headerH = 96;
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageW, headerH, 'F');

  // Logo or INVOICE title
  let logoDrawn = false;
  if (data.logoDataUrl) {
    try {
      const fmt = imageFormat(data.logoDataUrl);
      if (fmt) {
        const dims = fitImage(doc, data.logoDataUrl, contentW * 0.5, headerH - 28);
        doc.addImage(
          data.logoDataUrl,
          fmt,
          PAGE_MARGIN,
          (headerH - dims.h) / 2,
          dims.w,
          dims.h
        );
        logoDrawn = true;
      }
    } catch {
      logoDrawn = false;
    }
  }

  const headerText = readableTextOn(data.accentColor);
  const onLight = headerText === '#111111';
  const subGray = onLight ? 70 : 200;

  if (!logoDrawn) {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(26);
    doc.setTextColor(headerText);
    doc.text('INVOICE', PAGE_MARGIN, headerH / 2 + 4);
  }

  // Right side meta
  doc.setFont(FONT, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(subGray, subGray, subGray);
  doc.text(data.invoiceNumber || 'INV-0001', pageW - PAGE_MARGIN, headerH / 2 - 8, { align: 'right' });
  doc.text('Date: ' + niceDate(data.invoiceDate), pageW - PAGE_MARGIN, headerH / 2 + 10, { align: 'right' });

  y = headerH + 28;

  /* ---------- From / Bill To ---------- */
  const colW = contentW / 2 - 12;
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('FROM', PAGE_MARGIN, y);
  doc.text('BILL TO', PAGE_MARGIN + colW + 24, y);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  const senderLines = [data.sender.name, data.sender.email, data.sender.address].filter(Boolean);
  const clientLines = [data.client.name, data.client.email, data.client.address].filter(Boolean);
  let rowY = y + 16;
  senderLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, colW);
    wrapped.forEach((l: string) => {
      doc.text(l, PAGE_MARGIN, rowY);
      rowY += 15;
    });
  });
  let rowY2 = y + 16;
  clientLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, colW);
    wrapped.forEach((l: string) => {
      doc.text(l, PAGE_MARGIN + colW + 24, rowY2);
      rowY2 += 15;
    });
  });
  y = Math.max(rowY, rowY2) + 24;

  /* ---------- Items table ---------- */
  const headerH2 = 26;
  const nameX = PAGE_MARGIN + 10;
  const qtyX = PAGE_MARGIN + contentW * 0.56;
  const priceX = PAGE_MARGIN + contentW * 0.74;
  const totalX = PAGE_MARGIN + contentW - 10;

  ensureSpace(headerH2 + 24);

  // Table header
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(PAGE_MARGIN, y, contentW, headerH2, 'F');
  doc.setFont(FONT, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(readableTextOn(data.accentColor));
  doc.text('DESCRIPTION', nameX, y + 17);
  doc.text('QTY', qtyX, y + 17);
  doc.text('PRICE', priceX, y + 17, { align: 'right' });
  doc.text('AMOUNT', totalX, y + 17, { align: 'right' });
  y += headerH2;

  // Rows
  doc.setFont(FONT, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  data.items.forEach((it, idx) => {
    const label = it.name || 'Item';
    const qty = it.quantity || '0';
    const price = parseFloat(it.price) || 0;
    const wrapped = doc.splitTextToSize(label, qtyX - nameX - 12);
    const rowH = Math.max(24, wrapped.length * 14 + 10);

    ensureSpace(rowH);

    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(PAGE_MARGIN, y, contentW, rowH, 'F');
    }

    let textY = y + 16;
    wrapped.forEach((l: string) => {
      doc.text(l, nameX, textY);
      textY += 14;
    });
    const midY = y + rowH / 2 + 4;
    doc.text(qty, qtyX, midY);
    doc.text(formatGBP(price), priceX, midY, { align: 'right' });
    doc.text(formatGBP(lineTotal(it)), totalX, midY, { align: 'right' });

    // row separator
    doc.setDrawColor(232, 232, 232);
    doc.line(PAGE_MARGIN, y + rowH, PAGE_MARGIN + contentW, y + rowH);

    y += rowH;
  });

  y += 14;
  ensureSpace(120);

  /* ---------- Totals ---------- */
  const totalsW = 240;
  const totalsX = PAGE_MARGIN + contentW - totalsW;
  const valueX = PAGE_MARGIN + contentW;
  const rowGap = 21;

  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text('Subtotal', totalsX, y);
  doc.setTextColor(30, 30, 30);
  doc.text(formatGBP(calc.subtotal), valueX, y, { align: 'right' });
  y += rowGap;

  if (calc.discountAmount > 0) {
    doc.setTextColor(90, 90, 90);
    doc.text(`Discount (${data.discountPct || 0}%)`, totalsX, y);
    doc.setTextColor(30, 30, 30);
    doc.text('-' + formatGBP(calc.discountAmount), valueX, y, { align: 'right' });
    y += rowGap;
  }

  doc.setTextColor(90, 90, 90);
  doc.text('VAT (20%)', totalsX, y);
  doc.setTextColor(30, 30, 30);
  doc.text(formatGBP(calc.vat), valueX, y, { align: 'right' });
  y += rowGap;

  // Total row
  ensureSpace(40);
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(totalsX - 14, y - 16, totalsW + 14, 32, 'F');
  doc.setTextColor(readableTextOn(data.accentColor));
  doc.setFont(FONT, 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL DUE', totalsX, y + 4);
  doc.text(formatGBP(calc.total), valueX, y + 4, { align: 'right' });
  y += 52;

  /* ---------- Footer note ---------- */
  ensureSpace(40);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const termsWrapped = doc.splitTextToSize(data.paymentTerms, contentW);
  termsWrapped.forEach((l: string) => {
    ensureSpace(14);
    doc.text(l, PAGE_MARGIN, y);
    y += 13;
  });

  // Footer line on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    drawFooterLine(p);
  }

  doc.save(filename);
  return doc;
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' | null {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'PNG'; // jsPDF treats webp as png-ish; may fail
  if (dataUrl.startsWith('data:image/gif')) return 'PNG';
  return null;
}

function fitImage(
  doc: jsPDF,
  dataUrl: string,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  let imgW = maxW;
  let imgH = maxH;
  try {
    const props = doc.getImageProperties(dataUrl);
    imgW = props.width;
    imgH = props.height;
  } catch {
    // fall back to a conservative default
    const w = Math.min(maxW, 180);
    const h = Math.min(maxH, 56);
    return { w, h };
  }
  const ratio = Math.min(maxW / imgW, maxH / imgH, 1);
  return { w: imgW * ratio, h: imgH * ratio };
}
