import { useState, useRef } from "react";

const RATE_SHEET = [
  { from: "DAR PORT", destination: "KIGALI – RWANDA",      ft20: 3100, ft40: 3100, loose: 3100, type: "C28" },
  { from: "DAR PORT", destination: "LUSAKA – ZAMBIA",      ft20: 4000, ft40: 4000, loose: 4000, type: "C28" },
  { from: "DAR PORT", destination: "SOLWEZI – ZAMBIA",     ft20: 4800, ft40: 4800, loose: 4800, type: "C28" },
  { from: "DAR PORT", destination: "BUJUMBURA – BURUNDI",  ft20: 3200, ft40: 3200, loose: 3200, type: "C28" },
  { from: "DAR PORT", destination: "LILONGWE – MALAWI",    ft20: 4000, ft40: 4000, loose: 4000, type: "C28" },
  { from: "DAR PORT", destination: "BLANTYRE – MALAWI",    ft20: 4400, ft40: 4400, loose: 4400, type: "C28" },
  { from: "DAR PORT", destination: "KITWE – ZAMBIA",       ft20: 4000, ft40: 4000, loose: 4400, type: "C28" },
  { from: "DAR PORT", destination: "GOMA – DRC",           ft20: 4400, ft40: 4400, loose: 4400, type: "C28" },
  { from: "DAR PORT", destination: "BUKAVU – DRC",         ft20: 4800, ft40: 4800, loose: 4800, type: "C28" },
  { from: "DAR PORT", destination: "LUBUMBASHI – DRC",     ft20: 6400, ft40: 6400, loose: 6400, type: "C28" },
  { from: "DAR PORT", destination: "KOLWEZI – DRC",        ft20: 7200, ft40: 7200, loose: 7200, type: "C28" },
  { from: "DAR PORT", destination: "LIKASI – DRC",         ft20: 8500, ft40: 8500, loose: 8500, type: "C28" },
];

const fmt = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

// ── Calvary SVG Seal ──────────────────────────────────────────────
function CalvarySeal({ size = 100 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 340 340">
      <style>{`.st{font-family:'Times New Roman',serif;fill:#1a5fa8;letter-spacing:2px}`}</style>
      <circle cx="170" cy="170" r="155" fill="none" stroke="#1a5fa8" strokeWidth="4"/>
      <circle cx="170" cy="170" r="143" fill="none" stroke="#1a5fa8" strokeWidth="1.5"/>
      <path id="ta" d="M 28,165 A 142,142 0 0,1 312,165" fill="none"/>
      <text className="st" fontSize="17" fontWeight="700">
        <textPath href="#ta" startOffset="50%" textAnchor="middle">CALVARY INVESTMENT COMPANY LTD.</textPath>
      </text>
      <path id="ba" d="M 45,225 A 142,142 0 0,0 295,225" fill="none"/>
      <text className="st" fontSize="15" fontWeight="700">
        <textPath href="#ba" startOffset="50%" textAnchor="middle">★  TANZANIA  ★</textPath>
      </text>
      <text x="170" y="162" className="st" fontSize="14.5" fontWeight="700" textAnchor="middle" letterSpacing="1">P. O. Box 12929</text>
      <text x="170" y="184" className="st" fontSize="14.5" fontWeight="700" textAnchor="middle" letterSpacing="1">DAR ES SALAAM</text>
      <line x1="90" y1="195" x2="250" y2="195" stroke="#1a5fa8" strokeWidth="1.2"/>
      <line x1="95" y1="143" x2="245" y2="143" stroke="#1a5fa8" strokeWidth="1.2"/>
    </svg>
  );
}

// ── The printable contract document ──────────────────────────────
function ContractDocument({ data }) {
  const {
    clientName, clientAddress1, clientCity,
    contractDay, contractMonth, contractYear,
    clientSignatoryName, clientSignatoryTitle,
    clientWitnessName, clientWitnessTitle,
    transporterSignatoryName, transporterSignatoryTitle,
    transporterWitnessName, transporterWitnessTitle,
  } = data;

  const s = { // inline styles for print safety
    page:       { fontFamily: "'Times New Roman', Times, serif", fontSize: 12, lineHeight: 1.6, color: "#000", maxWidth: 780, margin: "0 auto", padding: "40px 50px" },
    h1:         { textAlign: "center", fontSize: 16, fontWeight: "bold", marginBottom: 4, letterSpacing: 1 },
    center:     { textAlign: "center" },
    bold:       { fontWeight: "bold" },
    section:    { fontWeight: "bold", marginTop: 18, marginBottom: 6, fontSize: 13 },
    p:          { marginBottom: 8, textAlign: "justify" },
    bullet:     { marginLeft: 24, marginBottom: 6, textAlign: "justify" },
    divider:    { borderTop: "2px solid #1a5fa8", margin: "20px 0" },
    thinLine:   { borderTop: "1px solid #ccc", margin: "12px 0" },
    sigTable:   { width: "100%", borderCollapse: "collapse", marginTop: 32 },
    sigCell:    { width: "45%", verticalAlign: "top", padding: "8px 12px", border: "1px solid #999", fontSize: 11 },
    sigGap:     { width: "10%", border: "none" },
    rateTable:  { width: "100%", borderCollapse: "collapse", fontSize: 11, marginTop: 12 },
    rateTh:     { background: "#1a3a6b", color: "#fff", padding: "7px 8px", border: "1px solid #444", textAlign: "left", fontWeight: "bold" },
    rateTd:     { padding: "5px 8px", border: "1px solid #ccc", textAlign: "left" },
    rateTdR:    { padding: "5px 8px", border: "1px solid #ccc", textAlign: "right" },
    annex:      { background: "#f0f4ff", border: "1px solid #c0c8e0", borderRadius: 4, padding: "10px 16px", marginBottom: 10 },
    footer:     { textAlign: "center", fontSize: 10, color: "#555", marginTop: 40, borderTop: "1px solid #ccc", paddingTop: 10 },
  };

  const day   = contractDay   || "______";
  const month = contractMonth || "________________________";
  const year  = contractYear  || "____";

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 24, borderBottom: "3px solid #1a3a6b", paddingBottom: 16 }}>
        <CalvarySeal size={90} />
        <div>
          <div style={{ ...s.h1, fontSize: 20, color: "#1a3a6b" }}>CALVARY INVESTMENT CO. LTD</div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#444" }}>P.O. Box 12929, Kinondoni Road, Dar Es Salaam, Tanzania</div>
          <div style={{ textAlign: "center", fontSize: 14, fontWeight: "bold", marginTop: 8, letterSpacing: 2, color: "#1a3a6b" }}>TRANSPORTATION AGREEMENT</div>
        </div>
      </div>

      {/* ── Parties ── */}
      <p style={{ ...s.p, ...s.center, fontWeight: "bold" }}>Between</p>
      <p style={{ ...s.p, ...s.center }}>
        <strong>{clientName || "{{CLIENT_COMPANY_NAME}}"}</strong><br/>
        {clientAddress1 || "{{CLIENT_ADDRESS_LINE1}}"}<br/>
        {clientCity || "{{CLIENT_CITY}}"}, Tanzania<br/>
        <em>Hereinafter referred to as <strong>"The Client"</strong></em>
      </p>
      <p style={{ ...s.p, ...s.center }}>And</p>
      <p style={{ ...s.p, ...s.center }}>
        <strong>CALVARY INVESTMENT CO. LTD</strong><br/>
        P.O. Box 12929, Kinondoni Road, Dar Es Salaam, Tanzania<br/>
        <em>Hereinafter referred to as <strong>"The Transporter"</strong></em>
      </p>

      <div style={s.divider}/>

      {/* ── Opening ── */}
      <p style={{ ...s.p, ...s.center, fontWeight: "bold", fontSize: 14 }}>ROAD CARRIAGE AGREEMENT</p>
      <p style={s.p}>
        This Agreement is made on the <strong>{day}</strong> day of <strong>{month}</strong> 20<strong>{year}</strong>.
      </p>
      <p style={s.p}>
        Between <strong>{clientName || "{{CLIENT_COMPANY_NAME}}"}</strong> of {clientAddress1 || "{{CLIENT_ADDRESS_LINE1}}"}, {clientCity || "{{CLIENT_CITY}}"} (hereinafter referred to as <strong>"The Client"</strong> which term shall where the context admits include its successors and assigns) and <strong>CALVARY INVESTMENT CO. LTD</strong>, registered office situated on Kinondoni Road, P.O. Box 12929, Dar Es Salaam, Tanzania (hereinafter referred to as <strong>"The Transporter"</strong> which term shall where the context admits include its successors and assigns).
      </p>

      {/* ── Clause 1 ── */}
      <p style={s.section}>1. PURPOSE OF THE AGREEMENT</p>
      <p style={s.p}>This agreement describes the terms and conditions under which the Transporter agrees to transport and deliver containers with their loaded cargo on behalf of The Client.</p>

      {/* ── Clause 2 ── */}
      <p style={s.section}>2. PERFORMANCE OF THE AGREEMENT</p>
      <p style={{ ...s.p, fontWeight: "bold" }}>The Transporter shall:</p>
      {[
        "Collect and deliver the consignment as instructed by The Client and immediately inform The Client of any unusual delay.",
        "In the event of loss, damage or mis-delivery, immediately inform The Client and supply a detailed statement from himself, the driver and the loader of the cause and circumstances together with any further information which The Client may require. If any loss is suspected to be due to theft or pilferage, immediately inform the police and provide all assistance required in tracing or recovering the consignment.",
        "Be responsible for any loss/damage to the consignment and shall indemnify The Client for such loss and damage unless such loss/damage has been occasioned by proven \"Force Majeure\" or accident outside the control/negligence of The Transporter or its Agents and Servants.",
        "Provide The Client with minimum twice-daily updates (AM & PM) on the status of cargo, together with GPS snapshot images upon request up to twice daily.",
        "Ensure all driver allowances, fuel for transport, and toll charges are covered by/for the Transporter's account.",
        "Lift off of empty containers, TRA electronic seal and Transit (RIT) bond are the responsibility of the Transporter.",
        "Agree to deliver transit cargo from Dar Es Salaam to various destinations as per agreed transit time. The Transporter shall give 5 working days free for border clearance for Zambia, Rwanda, Malawi and Burundi; 8 working days free for DRC; and 2–3 working days free for offloading from the time cargo arrives at client premises.",
        "The RIT transporter should arrange and clear trucks within 2 working days.",
        "Any overweight on axle or total GVM shall be communicated to The Client with a weigh bridge slip as supporting documentation.",
      ].map((t, i) => <p key={i} style={s.bullet}>• {t}</p>)}

      <p style={{ ...s.p, fontWeight: "bold", marginTop: 10 }}>The Client shall:</p>
      {[
        "Request trucks on FOT terms and provide a tentative loading date from the port based on vessel berthing schedule.",
        "Make sure that all shipping line and port charges are paid and that customs documentation is completed and handed over to the Transporter promptly.",
        "Confirm free demurrage days with the Transporter before booking at the POL.",
        "Ensure border clearance is undertaken/provided for and is The Client's responsibility.",
        "Ensure that any information required by the Transporter regarding its cargo is available at all times.",
        "Any demurrage charges that occur due to delays in clearance, offloading the cargo, or holding back the container will be on The Client's account.",
        "Any change of instruction will be communicated by phone and confirmed by email.",
      ].map((t, i) => <p key={i} style={s.bullet}>• {t}</p>)}

      {/* ── Clause 3 ── */}
      <p style={s.section}>3. THE TRANSPORTER SHALL</p>
      {[
        "If The Transporter fails or is unable to collect or deliver any consignment to any local or transit destination due to breakdowns, accidents etc., all extra costs incurred by The Client for transshipment or recovery of the consignment will be debited to the Transporter's account.",
        "Indemnify The Client against any liability under this Agreement arising after collection of consignment by The Transporter until delivery to the destination.",
        "Bear all extra costs incurred as a result of delay of delivery of consignment to destination without formal communication to The Client.",
        "Follow, observe and perform the services in compliance with General Health, Safety and Environmental Conditions.",
        "Comply with all applicable laws and regulations pertaining to road transport safety in Tanzania and neighbouring countries.",
        "Deliver the goods to the destinations as instructed by The Client without deviation, pilferage, spillage or shortages.",
        "Ensure all vehicles are in roadworthy and mechanical order.",
        "Ensure trucks have all valid licences and valid C28 as required by Tanzanian regulation.",
        "Ensure drivers are fully equipped with necessary PPE (safety hat, safety boot, mask, gloves etc.).",
        "Ensure drivers are checked with an alcohol test before starting any journey.",
        "Request empty drop-off 5 working days prior to truck arrival in Dar by email.",
        "Return the shipping line empty container within the grace period: Rwanda/Burundi/Malawi — 20 calendar days; Zambia — 30 calendar days; DRC — 45 calendar days.",
        "Obtain approval from The Client in writing via email before paying any extra costs.",
      ].map((t, i) => <p key={i} style={s.bullet}>• {t}</p>)}

      {/* ── Clause 4 ── */}
      <p style={s.section}>4. OPERATION</p>
      {[
        "All operations of the Transporter are to be conducted in a safe manner and in compliance with all rules, laws and regulations of the United Republic of Tanzania and neighbouring countries.",
        "All vehicles furnished by the Transporter shall be fully operable, in good operating condition, meet the specifications of The Client and any regulatory authority, and shall be maintained at the Transporter's sole expense during the term of this Agreement.",
      ].map((t, i) => <p key={i} style={s.bullet}>• {t}</p>)}

      {/* ── Clause 5 ── */}
      <p style={s.section}>5. DURATION OF ROAD CARRIAGE AGREEMENT</p>
      {[
        "This Agreement shall be valid for a period of one year from the date of contract and may be renewed upon the written consent of both parties.",
        "There will be a minimum of quarterly management reviews between the two parties to discuss rates, terms and conditions to ensure competitive market rates are maintained.",
        "This agreement is not exclusive. Performance, transit times and rates will be checked before any transport work is allocated by The Client to The Transporter.",
      ].map((t, i) => <p key={i} style={s.bullet}>• {t}</p>)}

      {/* ── Clause 6 ── */}
      <p style={s.section}>6. ASSIGNMENT OF CONTRACT</p>
      {[
        "The Transporter shall guarantee sufficient trucks/trailers within their fleet are dedicated to The Client to ensure expected volumes are met.",
        "The Transporter shall only assign, transfer or sub-contract this Transport Agreement with the prior written consent of The Client.",
      ].map((t, i) => <p key={i} style={s.bullet}>• {t}</p>)}

      {/* ── Clause 7 ── */}
      <p style={s.section}>7. PROVISION OF VEHICLES</p>
      <p style={s.p}>The Transporter undertakes that for the performance of this Agreement, it shall at all material times offer to The Client vehicles for which it has legal title of ownership and shall ensure vehicles are maintained in a roadworthy condition and all road service permits, licences, weights and measures and other approvals are obtained and maintained.</p>

      {/* ── Clause 8 ── */}
      <p style={s.section}>8. CONSIGNMENT</p>
      <p style={s.p}>Where the consignment is containerised, The Transporter shall return the empty container after transportation and delivery to the final destination at no extra charge, in good condition to the shipping line depot within the period stipulated in this agreement. If a container is not returned within the stipulated time frame, The Transporter shall be liable for demurrage charges.</p>

      {/* ── Clause 9 ── */}
      <p style={s.section}>9. DELIVERY</p>
      <p style={s.p}>The Transporter's responsibility with respect to the consignment shall commence when the goods are loaded onto its vehicles and shall terminate when the goods are delivered and unloaded at their destination and a delivery note is signed without reference to any loss or damage by the recipient.</p>

      {/* ── Clause 10 ── */}
      <p style={s.section}>10. DEMURRAGE CHARGES</p>
      {[
        "Demurrage shall be calculated and paid by The Transporter upon exhaustion of the agreed free days, except where it is proven that the delay has solely been caused by The Client's destination office's incomplete customs formalities.",
        "For delays in returning shipping line containers, The Transporter shall bear demurrage charges and pay directly to the shipping line. If The Transporter fails to pay, The Client will pay and charge a disbursement fee of 5% of the amount paid.",
      ].map((t, i) => <p key={i} style={s.bullet}>• {t}</p>)}

      {/* ── Clause 11 ── */}
      <p style={s.section}>11. TRANSPORT RATES</p>
      <p style={s.p}>As per <strong>Annexure A</strong> attached. Rates are subject to change due to increase or decrease of fuel prices and other market factors. <strong>Rates must be agreed at time of loading via written email confirmation approved by The Client before commencing loading.</strong> No hardcoded rates apply — all rates shall be reviewed and confirmed per shipment.</p>

      {/* ── Clause 12 ── */}
      <p style={s.section}>12. PAYMENT</p>
      <p style={s.p}><strong>(a)</strong> The agreed transport charges shall be paid 100% upon delivery of cargo and submission of the following documents: POD, empty container interchange, Tax Invoice with EFD receipt. Payment terms apply per destination: Zambia, Rwanda, Malawi, Burundi and Tanzania local trips — payment within agreed terms. DRC — payment at time of loading with all additional documents attached.</p>
      <p style={s.p}><strong>(b)</strong> Payment shall only be made if The Transporter is not in breach of any term of this agreement, subject to submission of supporting documents. Payment shall be made 15 days after proof of delivery/receipt of shipping line inwards interchange.</p>
      <p style={s.p}><strong>(c)</strong> All payments will be made in TZS based on the agreed exchange rate at time of loading.</p>
      <p style={{ ...s.p, fontWeight: "bold" }}>Payment Procedure:</p>
      {[
        "The Transporter delivers cargo to the final customer of The Client.",
        "The Transporter raises an invoice to The Client for transport service per agreed tariff.",
        "The Transporter delivers the original invoice to The Client's operations department with all supporting documents: Client delivery note (POD), shipping line empty drop-off interchange inwards, and TI & C2 signed by authorities.",
        "The Client receives the Transporter's invoice, signs the duplicate copy as confirmation of receipt, and processes for payment.",
        "The Client informs the Transporter once payment is ready for collection or transfer.",
      ].map((t, i) => <p key={i} style={s.bullet}>• {t}</p>)}

      {/* ── Clauses 13–28 ── */}
      {[
        { n: 13, title: "TERMS AND CONDITIONS", body: "This Agreement incorporates the terms, conditions and stipulations of carriage, requirements, and remarks for routing, volumes, reporting at various stations and payment as specified in the Delivery Notes. By signing Delivery Notes, The Transporter agrees to be bound by all such terms and conditions." },
        { n: 14, title: "WAITING CHARGES", body: "The Transporter shall only be entitled to waiting charges where it is proven that the delay was solely due to The Client's negligence. The Client's Customer must offload the truck within 3 working days of arrival at the delivery place. Beyond this period, a charge of USD 100 per day per truck/semi-trailer shall apply. Waiting charges must be agreed by The Client prior to issue of any waiting charges bill." },
        { n: 15, title: "ROUTES", body: "Each vehicle contracted for carriage of consignment to/from Dar Es Salaam Port must reach its destination within the agreed transit time. Failure to achieve such time will result in a penalty of USD 200 per day per TEU on account of the Transporter, unless the delay has been occasioned by proven \"Force Majeure\" or an accident outside the control/negligence of the Transporter." },
        { n: 16, title: "INTERCHANGE REPORTS", body: "Interchange reports duly signed must be obtained by The Transporter for any container off-loaded by The Client's destination office and submitted to The Client's depot of origin together with a duly signed and stamped Delivery Note. Unless these documents are submitted promptly, The Client will not pay any transport charges submitted." },
        { n: 17, title: "GENERAL AND PARTICULAR LIEN", body: "All payments and documents relating to this Agreement shall be subject to a general and particular lien by The Client against The Transporter in respect of any payments due to The Client from The Transporter, any claims for services not rendered by The Transporter, or loss or damage of the consignment." },
        { n: 18, title: "INSURANCE", body: "The Transporter shall take out policies of insurance covering all locations within Tanzania and outside as may be required, acceptable to The Client, against its liabilities under this Agreement, and shall produce such policies and receipts for current premiums to The Client on demand." },
        { n: 19, title: "CONFIDENTIALITY", body: "The Transporter shall keep confidential any information concerning The Client or its directors, officers or employees, or the services, which it receives from The Client and which are designated as confidential. The obligation of confidentiality shall survive the expiration or termination of this Agreement." },
        { n: 20, title: "RISK & OWNERSHIP", body: "Ownership of goods shall remain vested in the actual consignee (Principal) for the duration of services. However, the liability of goods and container from the point of loading on trucks and in transit shall solely rest with The Transporter." },
        { n: 21, title: "INDEMNITY", body: "The Transporter shall indemnify The Client from all liabilities and claims made against The Client as a result of The Transporter's actions while goods are in its possession. In the event of loss of goods, The Transporter shall indemnify The Client the full market value of the goods. Payment for any lost goods must be made within 30 days from the date of loss." },
        { n: 22, title: "NON-COMPETE", body: "The parties agree that they will not, during the term of this Agreement and for a period of one year thereafter, either directly or indirectly, make known to any person the names or addresses of any of the customers of each other, or call on, solicit or provide service to any customers whom either party became acquainted with during the term of this Agreement." },
        { n: 23, title: "TERMINATION", body: "This Agreement may be terminated by either party at any time on 30 working days' written notice. The Client is obliged to notify The Transporter within one month in the case of price changes so that negotiation can take place. Upon termination, The Transporter will submit a comprehensive list of all unpaid confirmed deliveries and in-transit moving cargo for computation of terminal financial obligations by The Client." },
        { n: 24, title: "NOTICES", body: "The parties shall give each other notice or other communication under this Contract in writing in English by fax, letter or email at the respective addresses stated in the contract." },
        { n: 25, title: "AMENDMENT", body: "This Agreement shall not be modified except in a written amendment signed by the duly authorised representatives of the parties." },
        { n: 26, title: "DISPUTE RESOLUTION", body: "The parties shall attempt to resolve any dispute through negotiations between senior executives. If the matter is not resolved by negotiation, the parties will attempt to resolve the dispute through Mediation. If Mediation fails, the parties shall refer the matter to the Courts with Jurisdiction in Tanzania whose judgment will be final." },
        { n: 27, title: "GOVERNING LAW", body: "This Transportation Contract is governed by the Laws of the United Republic of Tanzania." },
        { n: 28, title: "FORCE MAJEURE", body: "If through \"Force Majeure\" (Government embargo, war, blockade, revolution, insurrection, mobilisation, strikes, lockouts, riots, pandemic, or an act of God) one or both contracting parties are unable to perform their obligations under this contract, then the contract shall be considered cancelled and no penalties attached to the parties." },
      ].map(({ n, title, body }) => (
        <div key={n}>
          <p style={s.section}>{n}. {title}</p>
          <p style={s.p}>{body}</p>
        </div>
      ))}

      {/* ── Witness/Signature Block ── */}
      <div style={s.divider}/>
      <p style={{ ...s.p, ...s.center, fontWeight: "bold" }}>
        IN WITNESS WHEREOF, the parties hereto have caused this Agreement to be signed as of the {day} day of {month} 20{year}.
      </p>

      <table style={s.sigTable}>
        <tbody>
          <tr>
            <td style={s.sigCell}>
              <strong>Signed on behalf of The Client</strong><br/><br/>
              Name: &nbsp;&nbsp;{clientSignatoryName || "_________________________"}<br/><br/>
              Position: {clientSignatoryTitle || "_________________________"}<br/><br/>
              Signed: &nbsp;_________________________<br/><br/>
              <em>(Affix the company stamp)</em>
            </td>
            <td style={s.sigGap}/>
            <td style={s.sigCell}>
              <strong>Signed on behalf of The Client — Witness</strong><br/><br/>
              Name: &nbsp;&nbsp;{clientWitnessName || "_________________________"}<br/><br/>
              Position: {clientWitnessTitle || "_________________________"}<br/><br/>
              Signed: &nbsp;_________________________<br/><br/>
              <em>(Affix the company stamp)</em>
            </td>
          </tr>
          <tr><td colSpan={3} style={{ height: 16 }}/></tr>
          <tr>
            <td style={s.sigCell}>
              <strong>Signed on behalf of The Transporter</strong><br/><br/>
              Name: &nbsp;&nbsp;{transporterSignatoryName || "_________________________"}<br/><br/>
              Position: {transporterSignatoryTitle || "_________________________"}<br/><br/>
              Signed: &nbsp;_________________________<br/><br/>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                <CalvarySeal size={64}/>
                <em>(Affix the company stamp)</em>
              </div>
            </td>
            <td style={s.sigGap}/>
            <td style={s.sigCell}>
              <strong>Signed on behalf of The Transporter — Witness</strong><br/><br/>
              Name: &nbsp;&nbsp;{transporterWitnessName || "_________________________"}<br/><br/>
              Position: {transporterWitnessTitle || "_________________________"}<br/><br/>
              Signed: &nbsp;_________________________<br/><br/>
              <em>(Affix the company stamp)</em>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Annexure A ── */}
      <div style={{ marginTop: 48 }}>
        <div style={s.divider}/>
        <p style={{ ...s.h1, fontSize: 15, color: "#1a3a6b" }}>ANNEXURE A</p>
        <p style={{ ...s.h1, fontSize: 13 }}>RATE SHEET FOR TRANSPORT</p>
        <div style={{ ...s.annex, marginTop: 10 }}>
          <strong>Note:</strong> All rates below are indicative only. Rates are subject to change due to fuel price movements, market conditions and third-party statutory charges. <strong>Rates must be confirmed in writing by email at time of truck allocation and approved by The Client before loading commences.</strong>
        </div>
        <table style={s.rateTable}>
          <thead>
            <tr>
              {["FROM","DESTINATION","1×20FT (USD)","1×40FT (USD)","LOOSE (USD)","TRUCK TYPE"].map(h => (
                <th key={h} style={s.rateTh}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RATE_SHEET.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#f8faff" : "#fff" }}>
                <td style={s.rateTd}>{r.from}</td>
                <td style={s.rateTd}>{r.destination}</td>
                <td style={s.rateTdR}>{fmt(r.ft20)}</td>
                <td style={s.rateTdR}>{fmt(r.ft40)}</td>
                <td style={s.rateTdR}>{fmt(r.loose)}</td>
                <td style={{ ...s.rateTd, textAlign: "center" }}>{r.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12, fontSize: 11, color: "#333" }}>
          {[
            "All rates are in USD.",
            "Rates exclude port charges, customs fees, and applicable taxes.",
            "Rates are subject to change with 30 days' notice.",
            "A fuel surcharge may apply per route based on current fuel prices at time of loading.",
            "The rates above are to be reviewed and agreed at time of truck allocation prior to loading.",
          ].map((t, i) => <p key={i} style={{ marginBottom: 4 }}>• {t}</p>)}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={s.footer}>
        Calvary Investment Co. Ltd &nbsp;|&nbsp; P.O. Box 12929, Kinondoni Road, Dar Es Salaam, Tanzania
      </div>
    </div>
  );
}

// ── Main App: Form + Preview + Print ─────────────────────────────
export default function CalvaryContractTemplate() {
  const printRef = useRef(null);
  const [tab, setTab] = useState("form"); // "form" | "preview"
  const [form, setForm] = useState({
    clientName: "",
    clientAddress1: "",
    clientCity: "Dar es Salaam",
    contractDay: "",
    contractMonth: "",
    contractYear: new Date().getFullYear().toString(),
    clientSignatoryName: "",
    clientSignatoryTitle: "",
    clientWitnessName: "",
    clientWitnessTitle: "",
    transporterSignatoryName: "Managing Director",
    transporterSignatoryTitle: "Managing Director",
    transporterWitnessName: "",
    transporterWitnessTitle: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Transport Agreement — ${form.clientName || "Draft"}</title>
      <style>
        body { margin: 0; padding: 0; font-family: 'Times New Roman', serif; }
        @page { size: A4; margin: 18mm 20mm; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white";
  const labelCls = "block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wide";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 font-sans">

      {/* ── Top bar ── */}
      <div className="bg-[#1a3a6b] text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <CalvarySeal size={44}/>
          <div>
            <h1 className="text-base font-bold tracking-wide">Transportation Agreement Generator</h1>
            <p className="text-xs text-blue-200">Calvary Investment Co. Ltd — Contract Template</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("form")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === "form" ? "bg-white text-[#1a3a6b]" : "bg-blue-800 hover:bg-blue-700 text-white"}`}>
            ✏️ Edit Details
          </button>
          <button onClick={() => setTab("preview")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === "preview" ? "bg-white text-[#1a3a6b]" : "bg-blue-800 hover:bg-blue-700 text-white"}`}>
            👁 Preview
          </button>
          <button onClick={handlePrint}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition">
            🖨️ Print / PDF
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {tab === "form" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Client Details ── */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 pb-2">
                🏢 Client Information
              </h2>
              <div>
                <label className={labelCls}>Company Name *</label>
                <input className={inputCls} value={form.clientName} onChange={set("clientName")} placeholder="e.g. KARIMJEE VALUE CHAIN LTD."/>
              </div>
              <div>
                <label className={labelCls}>Address Line 1</label>
                <input className={inputCls} value={form.clientAddress1} onChange={set("clientAddress1")} placeholder="e.g. P.O. Box 409, Nyerere Road"/>
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={form.clientCity} onChange={set("clientCity")} placeholder="e.g. Dar es Salaam"/>
              </div>
            </div>

            {/* ── Contract Date ── */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 pb-2">
                📅 Contract Date
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Day</label>
                  <input className={inputCls} value={form.contractDay} onChange={set("contractDay")} placeholder="e.g. 1"/>
                </div>
                <div>
                  <label className={labelCls}>Month</label>
                  <input className={inputCls} value={form.contractMonth} onChange={set("contractMonth")} placeholder="e.g. June"/>
                </div>
                <div>
                  <label className={labelCls}>Year</label>
                  <input className={inputCls} value={form.contractYear} onChange={set("contractYear")} placeholder="e.g. 2026"/>
                </div>
              </div>
            </div>

            {/* ── Client Signatories ── */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 pb-2">
                ✍️ Client Signatories
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Signatory Name</label>
                  <input className={inputCls} value={form.clientSignatoryName} onChange={set("clientSignatoryName")} placeholder="Full name"/>
                </div>
                <div>
                  <label className={labelCls}>Signatory Title</label>
                  <input className={inputCls} value={form.clientSignatoryTitle} onChange={set("clientSignatoryTitle")} placeholder="e.g. Managing Director"/>
                </div>
                <div>
                  <label className={labelCls}>Witness Name</label>
                  <input className={inputCls} value={form.clientWitnessName} onChange={set("clientWitnessName")} placeholder="Full name"/>
                </div>
                <div>
                  <label className={labelCls}>Witness Title</label>
                  <input className={inputCls} value={form.clientWitnessTitle} onChange={set("clientWitnessTitle")} placeholder="e.g. Director"/>
                </div>
              </div>
            </div>

            {/* ── Transporter Signatories ── */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 pb-2">
                🚛 Transporter Signatories
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Signatory Name</label>
                  <input className={inputCls} value={form.transporterSignatoryName} onChange={set("transporterSignatoryName")}/>
                </div>
                <div>
                  <label className={labelCls}>Signatory Title</label>
                  <input className={inputCls} value={form.transporterSignatoryTitle} onChange={set("transporterSignatoryTitle")}/>
                </div>
                <div>
                  <label className={labelCls}>Witness Name</label>
                  <input className={inputCls} value={form.transporterWitnessName} onChange={set("transporterWitnessName")} placeholder="Full name"/>
                </div>
                <div>
                  <label className={labelCls}>Witness Title</label>
                  <input className={inputCls} value={form.transporterWitnessTitle} onChange={set("transporterWitnessTitle")} placeholder="e.g. Operations Manager"/>
                </div>
              </div>
            </div>

            {/* ── Rate Sheet preview ── */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 pb-2 mb-4">
                💰 Annexure A — Rate Sheet (read-only)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1a3a6b] text-white">
                      {["From","Destination","1×20FT","1×40FT","Loose","Type"].map(h => (
                        <th key={h} className="px-3 py-2 text-left border border-blue-900 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RATE_SHEET.map((r, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-blue-50 dark:bg-slate-800" : "bg-white dark:bg-slate-900"}>
                        <td className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300">{r.from}</td>
                        <td className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white font-medium">{r.destination}</td>
                        <td className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-right text-green-700 dark:text-green-400 font-mono">{fmt(r.ft20)}</td>
                        <td className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-right text-green-700 dark:text-green-400 font-mono">{fmt(r.ft40)}</td>
                        <td className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-right text-green-700 dark:text-green-400 font-mono">{fmt(r.loose)}</td>
                        <td className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-center text-gray-600 dark:text-gray-400">{r.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Generate button ── */}
            <div className="lg:col-span-2 flex gap-3">
              <button onClick={() => setTab("preview")}
                className="flex-1 py-3 bg-[#1a3a6b] hover:bg-[#1e4a8b] text-white rounded-xl font-semibold text-sm transition shadow">
                👁 Preview Contract
              </button>
              <button onClick={handlePrint}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition shadow">
                🖨️ Print / Save as PDF
              </button>
            </div>
          </div>

        ) : (
          // ── Preview tab ──
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Preview — {form.clientName || "Client name not set"} &nbsp;|&nbsp; {form.contractDay || "__"} {form.contractMonth || "______"} {form.contractYear}
              </p>
              <button onClick={handlePrint}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition">
                🖨️ Print / PDF
              </button>
            </div>
            <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
              <div ref={printRef}>
                <ContractDocument data={form}/>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
