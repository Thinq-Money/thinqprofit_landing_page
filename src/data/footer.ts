/**
 * §5 — the regulatory footer.
 *
 * Every value here was supplied by the business. Nothing in this file may be
 * written from inference, from a competitor's footer, or from an older draft:
 * docs/go-live-checklist.md is explicit that an invented registration number is
 * a regulatory offence rather than a typo.
 */

export interface RegistrationDetail {
  label: string
  value: string
  isPlaceholder?: boolean
}

export const entityInfo = {
  name: 'Money Logix Securities Pvt Ltd',
  cin: 'U64990MH2006PTC165522',
  sebiStockBroking: 'INZ000235531',
  sebiDP: 'IN-DP-22-2015',
  nseMember: '12971',
  bseMember: '3246',
  address: 'Vrindavan Annexe, 32 Mount Mary Road, Bandra (W), Mumbai 400050',
  phone: '+91 22 67827171 / 7172',
  email: 'support@moneylogix.in',
  complianceOfficer: 'Manoj Mahamunkar — Compliance Officer · mahamunkarmanoj@moneylogix.in',
  brokingGrievance: 'complaints@moneylogix.in',
  dpGrievance: 'bogrievances@moneylogix.in',
  uscnbAccountName: 'MONEY LOGIX SECURITIES PVT LTD - USCNB A/C',
  uscnbBankName: 'HDFC BANK LTD',
  uscnbAccountNo: '00600340039678',
  uscnbIfscCode: 'HDFC0000060',
}

export const derivativesRiskDisclosure = {
  title: 'RISK DISCLOSURES ON DERIVATIVES',
  bullets: [
    '9 out of 10 individual traders in equity Futures and Options Segment, incurred net losses.',
    'On an average, loss makers registered net trading loss close to ₹ 50,000.',
    'Over and above the net trading losses incurred, loss makers expended an additional 28% of net trading losses as transaction costs.',
    'Those making net trading profits, incurred between 15% to 50% of such profits as transaction cost.',
  ],
  source:
    '1. SEBI study dated January 25, 2023 on "Analysis of Profit and Loss of Individual Traders dealing in equity Futures and Options (F&O) Segment", wherein Aggregate Level findings are based on annual Profit/Loss incurred by individual traders in equity F&O during FY 2021-22.',
}

export const registrationDetails: RegistrationDetail[] = [
  {
    label: 'Legal Entity',
    value:
      'Money Logix Securities Pvt Ltd (CIN: U64990MH2006PTC165522)\nThinq is a brand owned by Money Logix Securities Pvt Ltd. All Thinq products are registered under Money Logix Securities Pvt Ltd.\nClients are advised to refer to our company as Money Logix Securities Pvt Ltd when communicating with regulatory authorities.',
  },
  {
    label: 'SEBI Registration',
    value:
      'Member of NSE and BSE — Stock Broking: INZ000235531\nDepository Participant with CDSL: IN-DP-22-2015\nExchange Membership No. — NSE: 12971 | BSE: 3246',
  },
  {
    label: 'Registered & Corporate Office',
    value:
      'Vrindavan Annexe, 32 Mount Mary Road, Bandra (W), Mumbai 400050\nPhone: +91 22 67827171 / 7172\nEmail: support@moneylogix.in',
  },
  {
    label: 'Compliance Officer',
    value: 'Manoj Mahamunkar — Compliance Officer\nEmail: mahamunkarmanoj@moneylogix.in',
    isPlaceholder: false,
  },
  {
    label: 'Upstreaming Client Bank Nodal Account (USCNB)',
    value:
      'ACCOUNT NAME: MONEY LOGIX SECURITIES PVT LTD - USCNB A/C\nBANK NAME: HDFC BANK LTD\nA/C NO: 00600340039678 | IFSC CODE: HDFC0000060',
  },
  {
    label: 'Grievance Redressal',
    value:
      'Stock broking: complaints@moneylogix.in\nDepository participant: bogrievances@moneylogix.in\nSEBI SCORES and the SMART ODR portal are linked below.',
  },
  /*
   * The SEBI Annexure-I risk disclosure is NOT listed here, deliberately.
   *
   * It used to be, and the footer printed it twice: once in this table and again
   * in the Annexure-I box further down (Footer.tsx). Every other entry in this
   * list is a registration fact — entity, SEBI number, office, compliance
   * officer, nodal account, grievance route — and the disclosure is not one of
   * those; it is a prescribed statement with a prescribed format.
   *
   * The copy that remains is the boxed one, which is the fuller of the two: it
   * carries the "SEBI Annexure-I" label and the complete source citation
   * including the FY 2021-22 basis, which the version here omitted. The
   * disclosure is still on the page in its entirety — only the second, shorter
   * rendering is gone.
   */
]

export const brandOwnershipStatement =
  'Please ensure that you carefully read the Risk Disclosure Document as prescribed by SEBI, our Terms & Conditions and Privacy Policy.'

export const communicationDisclaimer =
  'Disclaimer: All communications with the client via chat, phone, or email are for support purposes only. Any commitments or statements made by the agent (human or virtual) shall not be binding on the company.'

export interface InvestorAwarenessSection {
  title: string
  content: string
  /** Rendered as a numbered list beneath the content. */
  bullets?: string[]
}

export const investorAwarenessNotes: InvestorAwarenessSection[] = [
  {
    title: 'Attention Investors',
    content:
      'Investors should be cautious on unsolicited emails and SMS advising to buy, sell or hold securities and trade only on the basis of informed decision. Investors are advised to invest after conducting appropriate analysis of respective companies and not to blindly follow unfounded rumours, tips etc. Further, you are also requested to share your knowledge or evidence of systemic wrongdoing, potential frauds or unethical behaviour through the anonymous portal facility provided on the BSE and NSE websites.',
  },
  {
    title: 'Warning on Fraudulent Schemes',
    content:
      'Valued clients and investors, please be warned about fraudulent investment schemes being circulated. These scams often promise high returns with little to no risk. If they falsely claim to be from Money Logix Securities Pvt Ltd or our partners, please report to us on complaints@moneylogix.in.',
  },
  {
    title: 'We Do Not Give Stock Tips',
    content:
      'We do not give stock tips or recommendations and have not authorized anyone to give this on behalf of us. If you know anyone claiming to be a part of Money Logix Securities Pvt Ltd or our associate companies or partners and offering such services, please report to us on complaints@moneylogix.in.',
  },
  {
    title: 'Protect Your Account',
    content:
      'To prevent unauthorized transactions in your trading or demat account, do not share your account details, credentials or any personal details with anyone. Keep your mobile number updated with your Stock Broker and Depository Participant, and ensure that the same is registered with the Stock Exchanges, Depository and KRAs. You will receive alerts and information on your registered mobile number and email for debit and other important transactions in your demat account directly from CDSL and the Exchange on the same day.',
  },
  {
    title: 'KYC and IPO Applications',
    content:
      'KYC is a one time exercise while dealing in securities markets — once KYC is done through a SEBI registered intermediary (Stock Broker, DP, Mutual Fund, etc.), an investor does not need to repeat the procedure when approaching another intermediary. No need to issue cheques by investors while subscribing to an IPO: just write the bank account number and sign in the application form to authorise your bank to make payment in case of allotment. No worries for refund, as the money remains in the investor’s account.',
  },
  {
    title: 'Guidelines on Margin Collection',
    content: 'Issued in the interest of the investors.',
    bullets: [
      'Stock brokers can accept securities as margin from clients only by way of pledge in the depository system, with effect from September 01, 2020.',
      'Update your email and phone number with your stock broker or depository participant and receive the OTP directly from the depository on your email and/or mobile number to create a pledge.',
      'Pay 20% upfront margin of the transaction value to trade in the cash market segment.',
      'Investors may please refer to the Exchange’s Frequently Asked Questions issued vide circular reference NSE/INSP/45191 dated July 31, 2020 and NSE/INSP/45534 dated August 31, 2020, and other guidelines issued from time to time in this regard.',
      'Check your securities, mutual funds and bonds in the consolidated account statement issued by NSDL and CDSL every month.',
    ],
  },
]

export const complaintsProcedures = {
  smartODR:
    'Procedure to file a complaint on SMART ODR: Register on the Smart ODR portal. Mandatory details for filing complaints: Name, PAN, Address, Mobile Number, E-mail ID. Benefits: effective communication and speedy redressal of grievances.',
  sebiScores:
    'Procedure to file a complaint on SEBI SCORES: Register on the SCORES portal. Mandatory details for filing complaints on SCORES: Name, PAN, Address, Mobile Number, E-mail ID. Benefits: effective communication and speedy redressal of grievances. You may also download the SEBI SCORES app to log a complaint.',
  scoresUrl: 'https://scores.sebi.gov.in/',
  scoresAndroidUrl: 'https://play.google.com/store/apps/details?id=com.sebi.scores',
  scoresIosUrl: 'https://apps.apple.com/in/app/sebi-scores/id1493257302',
}

export const vernacularDownloads = {
  label:
    "Download client registration documents (Rights & Obligations, Risk Disclosure Document, Do's & Don'ts) in vernacular language:",
  links: [
    { name: 'BSE', url: 'https://www.bseindia.com' },
    { name: 'NSE', url: 'https://www.nseindia.com' },
    { name: 'MCX', url: 'https://www.mcxindia.com' },
  ],
}

export const advisoryGuidelines = {
  label:
    'Kindly read the Advisory Guidelines for investors as prescribed by the exchanges, with reference to their circular dated 27th August 2021 regarding investor awareness and safeguarding client assets:',
  links: [
    { name: 'BSE', url: 'https://www.bseindia.com' },
    { name: 'NSE', url: 'https://www.nseindia.com' },
    { name: 'MCX', url: 'https://www.mcxindia.com' },
  ],
}

export const importantLinks = [
  { name: 'Privacy Policy', url: '/terms#privacy' },
  { name: 'Terms', url: '/terms' },
  { name: 'Risk Disclosure', url: '/terms#risk' },
  { name: 'Investor Complaints Data', url: '/terms#complaints' },
  { name: 'Investor Charter — Broking', url: 'https://www.nseindia.com' },
  { name: 'Investor Charter — DP', url: 'https://www.cdslindia.com' },
  { name: 'Advisory for Investors', url: 'https://www.nseindia.com' },
  { name: 'e-Voting for Shareholders', url: 'https://www.evoting.nsdl.com' },
  { name: 'NCL Client Collateral', url: 'https://www.nseclearing.com' },
  { name: 'MCXCCL Client Collateral', url: 'https://www.mcxccl.com' },
  { name: 'SEBI', url: 'https://www.sebi.gov.in' },
  { name: 'NSE', url: 'https://www.nseindia.com' },
  { name: 'BSE', url: 'https://www.bseindia.com' },
  { name: 'MCX', url: 'https://www.mcxindia.com' },
  { name: 'CDSL', url: 'https://www.cdslindia.com' },
  { name: 'SCORES', url: 'https://scores.sebi.gov.in' },
  { name: 'SMART ODR', url: 'https://smartodr.in' },
]

export const disclaimers = [
  {
    title: 'Market Risk',
    content:
      'Investments in the securities market are subject to market risks. Read all the related documents carefully before investing. Brokerage will not exceed the SEBI prescribed limit. Nothing on this page is a recommendation to buy or sell any security.',
  },
  {
    title: 'No Warranty',
    content:
      'Money Logix Securities Pvt Ltd makes no warranties or representation, express or implied, on products offered through the platform. It accepts no liability for any damages or losses, however caused, with the use of, or on the reliance of, its product or related services. Unless otherwise specified, all returns, expense ratio, NAV, etc. are historical and for illustrative purposes only. Future results will vary greatly and depend on personal and market circumstances. The information provided by our blog is educational only and is not investment or tax advice.',
  },
  {
    title: 'Order Collection Platform',
    content:
      'Money Logix Securities Pvt Ltd, also known as Thinq, is only an order collection platform that collects orders on behalf of clients and places them on BSE StarMF for execution. The client expressly agrees that Thinq is not liable or responsible and does not represent or warrant any damages regarding non-execution of orders, or any incorrect execution of orders with regard to the funds chosen by the client, or due to — but not limited to — any link or system failure, delay in transfer of the funds on account of any unforeseen circumstances or issues in the banking system or payment aggregators, or any other problems that may result in a delay in crediting the funds into BSE StarMF.',
  },
]

export const copyrightEntity = 'Money Logix Securities Pvt Ltd'
export const copyrightSuffix = 'All rights reserved.'
