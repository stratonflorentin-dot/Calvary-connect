// @ts-nocheck
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
    console.log('Request body:', body);
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

      // Try to locate a system-installed Chrome/Chromium as a fallback
      const possibleChromePaths = [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe'
      ].filter(Boolean) as string[];

      let executablePath: string | undefined;
      for (const p of possibleChromePaths) {
        try {
          if (p && fs.existsSync(p)) {
            executablePath = p;
            break;
          }
        } catch (e) {
          // ignore
        }
      }

      const launchArgs: any = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
      if (executablePath) launchArgs.executablePath = executablePath;

      const browser = await puppeteer.launch(launchArgs);
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
    const templatesDir = path.join(process.cwd(), 'templates');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    const templatePath = path.join(templatesDir, 'Calvary_Transport_Contract_Template.docx');
    console.log('Template path:', templatePath);
    console.log('Template exists:', fs.existsSync(templatePath));

    if (!fs.existsSync(templatePath)) {
      let filesInTemplates: string[] = [];
      filesInTemplates = fs.readdirSync(templatesDir);
      console.log('Files in templates directory:', filesInTemplates);
      return new Response(`Template file not found. Please place Calvary_Transport_Contract_Template.docx in the /templates folder. Found files: ${filesInTemplates.join(', ')}`, { status: 500 });
    }

    const content = fs.readFileSync(templatePath, 'binary');
    console.log('Template file read successfully');
    const zip = new PizZip(content);

    // Preprocess Word XML files to normalize/repair split mustache tags
    try {
      const xmlFileNames = Object.keys(zip.files).filter((n) => /word\/(document|header\d*|footer\d*)\.xml$/.test(n));
      for (const name of xmlFileNames) {
        try {
          let xml = zip.file(name).asText();
          const before = xml;

          // Collapse stray spaces inside braces and remove XML tags between mustache delimiters
          xml = xml.replace(/\{\{[\s\S]*?\}\}/g, (m) => {
            const inner = m.slice(2, -2);
            const cleaned = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            return '{{' + cleaned + '}}';
          });

          // Fix cases where braces are separated like "{ {" or "} }"
          xml = xml.replace(/\{\s+\{/g, '{{').replace(/\}\s+\}/g, '}}');

          if (xml !== before) {
            zip.file(name, xml);
            console.log(`Normalized mustache tags in ${name}`);
          }
        } catch (e) {
          // Non-fatal: continue processing other xml parts
          console.warn(`Failed to preprocess ${name}:`, e);
        }
      }
    } catch (e) {
      console.warn('Preprocessing of DOCX XML failed', e);
    }
    let doc: any;
    try {
      doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      doc.render(data);
    } catch (err: any) {
      console.error('Docxtemplater render error', err);
      // If docxtemplater provides detailed errors, return them to help fix the template
      const details: string[] = [];
      if (err && err.properties && Array.isArray(err.properties.errors)) {
        for (const e of err.properties.errors) {
          const ctx = e?.properties?.context || e?.context || JSON.stringify(e);
          const explain = e?.properties?.explanation || e?.explanation || '';
          details.push(`${ctx}: ${explain}`);
        }
      } else if (err && err.message) {
        details.push(err.message);
      } else {
        details.push(String(err));
      }

      const msg = `DOCX template parse error. Likely duplicate or malformed tags (e.g. {{...}}) in the Word template. Details: ${details.join(' | ')}`;
      return new Response(msg, { status: 400 });
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
    console.error('Error details:', JSON.stringify(err, null, 2));
    return new Response('Error generating contract: ' + (err?.message || String(err)), { status: 500 });
  }
}
