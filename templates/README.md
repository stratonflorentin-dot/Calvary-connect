Place your Word contract template file here and name it exactly:

  Calvary_Transport_Contract_Template.docx

This project includes a server endpoint that uses `docxtemplater` to populate placeholders in the `.docx` template.

Setup
1. Install the required packages:

```bash
npm install docxtemplater pizzip
```

2. Put the provided `Calvary_Transport_Contract_Template.docx` file in this folder.

Usage
- From the Contracts UI (Preview) click `Download .docx` to POST the contract data to `/api/contracts/generate` and receive a populated `.docx` download.

- To generate a PDF server-side, the endpoint supports `format=pdf`. The frontend can POST to `/api/contracts/generate?format=pdf` with the same payload and will receive a PDF response.

Setup additional dependency for PDF conversion
1. Install Puppeteer:

```bash
npm install puppeteer
```

Note: Puppeteer downloads a Chromium binary by default which increases install size. On some hosting platforms you may prefer `puppeteer-core` with a provided browser, or use LibreOffice for docx->pdf conversion. Ensure your server environment allows headless Chromium (install required system libs on Linux).

Notes
- The template should use simple `{{placeholder}}` tags matching the keys in the payload sent from the frontend. For example `{{customer.company_name}}` or `{{contract_date}}`.
- Converting the generated `.docx` to PDF requires an external converter (LibreOffice, unoconv, or a cloud conversion service) — this code returns the filled `.docx` file only.
