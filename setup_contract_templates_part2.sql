-- ==========================================
-- CONTRACT TEMPLATES - PART 2: Default Data
-- ==========================================

-- Insert Transportation Template
INSERT INTO contract_templates (
    template_name,
    template_type,
    company_name,
    company_address,
    ceo_name,
    ceo_title,
    contract_title,
    preamble,
    clauses,
    terms_conditions,
    is_default,
    is_active
) VALUES (
    'Standard Transportation Agreement',
    'transportation',
    'Calvary Investment Company Limited',
    'P.O. Box 12929, Kinondoni Road, Dar Es Salaam, Tanzania',
    'Tumaini Josephat Tesha',
    'Chief Executive Officer',
    'TRANSPORTATION AGREEMENT',
    'This Agreement is made between {{client_name}} of {{client_address}} (hereinafter referred to as "The Client") and Calvary Investment Company Limited of P.O. Box 12929, Kinondoni Road, Dar Es Salaam (hereinafter referred to as "The Transporter").',
    '[
        {"number": "1", "title": "Purpose of the Agreement", "content": "This agreement describes the terms and conditions under which the Transporter agrees to transport and deliver container with its loaded cargo on behalf of The Client."},
        {"number": "2", "title": "Performance of the Agreement - The Transporter shall", "content": "(a) Collect and deliver the consignment as instructed by The Client and immediately inform The Client of any unusual delay.\n(b) In the event of loss/damage or mis-delivery, immediately inform The Client and supply a detailed statement.\n(c) Be responsible for any loss/damage to the consignment and shall indemnify The Client unless loss/damage is due to proven ''Force Majeure''.\n(d) Provide The Client with minimum twice daily updates (AM & PM) on status of cargo.\n(e) Ensure all driver allowances, fuel for transport, and toll charges are provided for by the Transporter.\n(f) Lift off of empty containers & TRA electronic seal and Transit (RIT) bond is responsibility of the Transporter.\n(g) Deliver transit cargo from Dar Es Salaam to various destinations as per agreed transit time.\n(h) The RIT transporter should arrange and clear trucks within 2 working days.\n(i) Any overweight on axle or total GVM, the Transporter is responsible to inform client with weigh bridge slip."},
        {"number": "3", "title": "The Client shall", "content": "(a) Request truck on FOT terms and provide tentative loading date from the port.\n(b) Make sure all shipping line and port charges are paid.\n(c) Confirm free demurrage days with the Transporter before booking at the POL.\n(d) Border clearance is The Client''s responsibility.\n(e) Make sure information required by the Transporter is available at any time.\n(f) Any demurrage charges due to delays in clearance/offloading will be on The Client account."},
        {"number": "4", "title": "Transit Time & Free Days", "content": "The Transporter shall give 5 working days free for border clearance for Zambia, Rwanda, Malawi and Burundi, and 8 working days for DRC. 2-3 working days free for offloading from time cargo arrives at client premises depending on volumes."},
        {"number": "5", "title": "Transport Rates", "content": "As per attached Annexure A rates to apply for local and transit cargo. Note the rates are subject to change due to increase or decrease of fuel rates. Rates to be agreed at time of loading via email written confirmation."},
        {"number": "6", "title": "Payment Terms", "content": "(a) Payment shall be made 100% upon delivery of cargo and submission of: POD, empty container interchange, Tax invoice with EFD receipt.\n(b) For Zambia, Rwanda, Malawi, Burundi and Tanzania local trips: paid upon delivery.\n(c) For DRC: paid at time of loading.\n(d) All payments will be paid in TZS based on agreed exchange rate at time of loading."},
        {"number": "7", "title": "Demurrage & Waiting Charges", "content": "(a) The Client''s Customer has to offload the truck within 3 working days. Exceeding this period will be charged US$100 additional per day per truck.\n(b) Grace period for returning empty containers: Rwanda/Burundi/Malawi - 20 days, Zambia - 30 days, DRC - 45 days.\n(c) The transporter shall bear demurrage charges for delays in returning shipping line containers."},
        {"number": "8", "title": "Penalties", "content": "Each vehicle must reach its destination within the normal agreed transit time. Failure will result in a penalty of USD 200 per day per TEU unless delay is due to proven ''Force Majeure''."},
        {"number": "9", "title": "Insurance & Liability", "content": "The Transporter shall take out insurance covering all liabilities under this Agreement. The Transporter shall indemnify The Client against any loss, damage, or liability arising from willful act, default, or negligence."},
        {"number": "10", "title": "Duration & Termination", "content": "This Agreement shall be valid for a period of One year from the date of contract and may be subject to renewal upon written consent of both parties. Either party may terminate on 30 working days written notice."},
        {"number": "11", "title": "Confidentiality", "content": "The Transporter shall keep confidential any information concerning The Client and shall not divulge the same to any third party except as required by law or for performance of this Agreement."},
        {"number": "12", "title": "Governing Law", "content": "This Transportation Contract is governed by the Laws of the United Republic of Tanzania."}
    ]'::jsonb,
    'Additional terms: (a) The Transporter must request empty drop off 5 working days prior to truck arrival to Dar. (b) Any extra cost must get approval from the client in writing. (c) All vehicles must be road-worthy with valid C28 licenses. (d) Drivers must have necessary PPE and pass alcohol test.',
    TRUE,
    TRUE
)
ON CONFLICT DO NOTHING;

SELECT 'Part 2 complete - Default template inserted' as status;
