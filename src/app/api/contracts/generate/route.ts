import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

async function buildHtml(data: any) {
  const template = data.template || {};
  const customer = data.customer || {};
  const rateSheet = data.rate_sheet || null;
  const contractDate = data.contract_date || new Date().toISOString().split('T')[0];

  // Minimal server-side HTML generator mirroring client preview
  return `<!doctype html><html><head><meta charset="utf-8"><title>Contract</title></head><body>${
    `<div style="font-family: 'Times New Roman', serif; max-width:800px;margin:0 auto;padding:40px;line-height:1.6;">
      <h1 style="text-align:center;color:#1e3a5f">${template.contract_title || template.template_name || 'Transport Agreement'}</h1>
      <p style="text-align:center">${template.company_name || ''} | ${template.company_address || ''}</p>
      <hr/>
      <h3>Between</h3>
      <p><strong>${customer.company_name || ''}</strong><br/>${customer.address || ''}</p>
      <p><strong>${template.company_name || ''}</strong><br/>${template.company_address || ''}</p>
      <p style="text-align:center"><strong>This Agreement is made on ${new Date(contractDate).toLocaleDateString()}</strong></p>
      <div>${(template.preamble||'')}</div>
      <hr/>
      <h3>Terms and Conditions</h3>
      ${ (template.clauses || []).map((c: any) => `<h4>${c.number}. ${c.title}</h4><p>${c.content}</p>`).join('') }
      ${ rateSheet ? `
        <h3 style="page-break-before:always">ANNEXURE A - RATE SHEET</h3>
        <p><strong>${rateSheet.rate_sheet_name}</strong> - Effective: ${new Date(rateSheet.effective_date||Date.now()).toLocaleDateString()}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr><th>From</th><th>Destination</th><th>20ft</th><th>40ft</th><th>Loose</th><th>Truck</th><th>Days</th></tr></thead>
          <tbody>
            ${ (rateSheet.rates||[]).map((r:any) => `
              <tr>
                <td>${r.from||''}</td>
                <td>${r.destination||''}</td>
                <td style="text-align:right">${r.container_20ft||''}</td>
                <td style="text-align:right">${r.container_40ft||''}</td>
                <td style="text-align:right">${r.loose||''}</td>
                <td>${r.truck_type||''}</td>
                <td style="text-align:center">${r.transit_days||''}</td>
              </tr>
            `).join('') }
          </tbody>
        </table>
      ` : '' }
    </div>`
  }</body></html>`;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format');
    const body = await req.json();
    const data = body?.data || {};

    if (format === 'pdf') {
      // Generate HTML and convert to PDF using Puppeteer
      let puppeteer: any;
      try {
        puppeteer = await import('puppeteer');
      } catch (e) {
        console.error('Puppeteer import error', e);
        return new Response('Puppeteer not installed. Install puppeteer to enable PDF generation.', { status: 500 });
      }

      const html = await buildHtml(data);

      const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      const safeName = (data?.customer?.company_name || 'contract').toString().replace(/[^a-z0-9]+/gi, '_');
      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=Contract-${safeName}.pdf`
        }
      });
    }

    // Default: DOCX generation using docxtemplater
    const templatePath = path.join(process.cwd(), 'templates', 'Calvary_Transport_Contract_Template.docx');
    if (!fs.existsSync(templatePath)) {
      return new Response('Template file not found. Please place Calvary_Transport_Contract_Template.docx in the /templates folder.', { status: 500 });
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    try {
      doc.render(data);
    } catch (err: any) {
      const e = err;
      console.error('Docxtemplater render error', e);
      return new Response('Template render error: ' + (e?.message || String(e)), { status: 500 });
    }

    const buf = doc.getZip().generate({ type: 'nodebuffer' });

    const safeName = (data?.customer?.company_name || 'contract').toString().replace(/[^a-z0-9]+/gi, '_');

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename=Contract-${safeName}.docx`
      }
    });
  } catch (err: any) {
    console.error('Generate contract error', err);
    return new Response('Error generating contract: ' + (err?.message || String(err)), { status: 500 });
  }
}
