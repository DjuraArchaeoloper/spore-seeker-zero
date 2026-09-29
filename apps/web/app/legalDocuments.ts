export type LegalDocument = {
  title: string;
  description: string;
  path: "/terms" | "/privacy" | "/data-deletion";
  markdown: string;
};

export const legalDocuments = {
  terms: {
    title: "SPØR - Terms of Service",
    description: "Terms of Service for SPØR - Seeker Zero.",
    path: "/terms",
    markdown: `# SPØR - Terms of Service

**Last updated: September 29, 2026**

These Terms of Service (“Terms”) govern your access to and use of SPØR - Seeker Zero (“SPØR,” the “App,” or the “Service”), operated by **Djuradj Djuric** (“we,” “us,” or “our”).

By connecting a wallet to SPØR, accessing the Service, or using the Service, you agree to these Terms. If you do not agree, do not use SPØR.

## 1. What SPØR Is

SPØR is a digital species experience built on the Solana blockchain.

Users with a compatible Solana Mobile device and eligible Seeker Genesis Token (“SGT”) may interact with organisms, release and claim spores, create descendant organisms, view bloodlines, and receive blockchain-based records associated with those organisms.

SPØR is a digital experience and collectible system. It is not an investment product, financial service, exchange, brokerage, bank, wallet provider, or investment advisory service.

## 2. Eligibility

You must be at least 18 years old, or the age of legal majority where you live, and capable of entering into a binding agreement to use SPØR.

You may not use SPØR where doing so would violate applicable law.

## 3. Wallets and Self-Custody

SPØR uses compatible third-party Solana wallets.

We do not control your wallet and do not have access to your private keys, seed phrase, recovery phrase, or wallet credentials.

You are solely responsible for:

- securing your wallet and device;
- reviewing transactions before approving them;
- protecting your private keys and recovery information; and
- maintaining access to the wallet used with SPØR.

SPØR will never ask you to provide your seed phrase or private key.

Transactions authorized through your wallet may be irreversible once submitted to and confirmed by the Solana network.

## 4. Seeker Identity

SPØR uses an eligible Seeker Genesis Token as the permanent identity associated with an organism.

A wallet address may act as the current signing authority, but the wallet address itself is not necessarily the permanent SPØR identity.

Eligibility and organism creation may depend on verification of an eligible SGT and other on-chain conditions.

## 5. Organisms, Spores, and Births

SPØR operates according to rules implemented by the SPØR application and Solana program.

A successful birth may create permanent blockchain records, including organism identity, ancestry, generation, genome information, timestamps, and related blockchain transaction data.

Because these records are written to a public blockchain, they may remain publicly available indefinitely and generally cannot be altered or deleted by us.

SPØR may impose protocol rules such as eligibility requirements, cooldowns, offer expirations, limits on the number of organisms associated with an SGT, and other biological or gameplay constraints.

## 6. Blockchain Fees and Protocol Fees

Some SPØR actions may require you to authorize a Solana transaction.

A transaction may include:

- Solana network transaction fees;
- costs associated with creating blockchain assets; and
- a SPØR protocol fee associated with a successful birth.

The applicable transaction is presented through your wallet for authorization.

Blockchain transactions generally cannot be cancelled or refunded after confirmation. Network fees paid to the Solana network or other blockchain infrastructure are not controlled by us.

## 7. Organism NFTs

A successfully created organism may receive a Metaplex Core digital asset that functions as its blockchain birth certificate or collectible representation.

The underlying SPØR organism state, rather than the NFT alone, determines the organism's canonical biological state within SPØR.

SPØR organism NFTs are designed to be non-transferable. They are not intended to create a marketplace or trading economy.

We make no representation or guarantee that any organism, NFT, blockchain asset, or other element of SPØR has or will ever have monetary value.

You should not use SPØR with an expectation of profit, appreciation, resale value, investment return, or financial reward.

## 8. Public Blockchain Information

Solana is a public blockchain.

Information recorded on-chain may be visible to anyone and may be copied, indexed, analyzed, or stored by third parties independently of SPØR.

We do not control the Solana network and cannot delete, reverse, conceal, or modify information that has been permanently recorded on it.

## 9. Third-Party Services

SPØR relies on third-party technology and services, which may include:

- the Solana network;
- compatible wallet applications;
- Solana Mobile and the Solana dApp Store;
- blockchain infrastructure and RPC providers;
- Metaplex protocols;
- hosting providers; and
- database and indexing infrastructure.

Those services are operated independently from SPØR and may be governed by their own terms and privacy policies.

We are not responsible for third-party services, wallets, blockchain networks, outages, protocol changes, or actions taken by third-party providers.

## 10. Acceptable Use

You may not:

- use SPØR for unlawful purposes;
- attempt to bypass SGT or organism eligibility rules;
- interfere with or exploit SPØR's smart contracts, API, authentication systems, or infrastructure;
- attempt to create organisms through unauthorized methods;
- submit fraudulent, manipulated, or malicious transactions;
- interfere with another user's use of SPØR;
- introduce malware or harmful code;
- attempt unauthorized access to SPØR infrastructure; or
- use SPØR in a manner that violates applicable sanctions, export-control laws, or other applicable regulations.

Security research conducted responsibly and without harming users or infrastructure may be reported to us at **djura2707@gmail.com**.

## 11. Intellectual Property

Except for content, software, protocols, or trademarks owned by third parties, SPØR and its associated branding, artwork, interfaces, software, creature designs, visual assets, text, and other original materials are owned by or licensed to **Djuradj Djuric**.

These Terms give you a limited, personal, non-exclusive, non-transferable right to use SPØR for its intended purpose.

They do not transfer ownership of SPØR's intellectual property to you.

Ownership or control of an organism or associated blockchain asset does not transfer ownership of the SPØR software, brand, underlying creature art system, or other intellectual property unless we expressly state otherwise.

## 12. Availability and Changes

SPØR is experimental software built using evolving blockchain technology.

We may modify, update, suspend, or discontinue parts of the Service where reasonably necessary for security, legal compliance, maintenance, product development, or technical reasons.

Certain rules enforced permanently by deployed blockchain programs may not be capable of being changed by us.

We do not guarantee uninterrupted or error-free access to SPØR.

## 13. Risks

By using SPØR, you acknowledge risks inherent to blockchain software, including:

- transaction failures;
- network congestion;
- software bugs;
- wallet vulnerabilities;
- loss of wallet access;
- blockchain outages;
- changes to third-party protocols;
- incorrect transaction authorization; and
- permanent public recording of blockchain activity.

You are responsible for reviewing wallet transaction requests before signing them.

## 14. No Financial Advice

Nothing in SPØR constitutes financial, investment, legal, tax, or accounting advice.

SPØR does not make recommendations concerning the purchase, sale, holding, or value of digital assets.

## 15. Disclaimer of Warranties

To the fullest extent permitted by applicable law, SPØR is provided on an “as is” and “as available” basis.

We do not guarantee that the Service will always be available, secure, uninterrupted, or free from defects.

Nothing in these Terms excludes warranties or consumer rights that cannot lawfully be excluded.

## 16. Limitation of Liability

To the fullest extent permitted by applicable law, **Djuradj Djuric** will not be liable for indirect, incidental, special, consequential, or punitive damages arising from your use of SPØR, including loss resulting from blockchain transactions, wallet access, network failures, or third-party services.

Nothing in these Terms limits liability where such limitation is prohibited by applicable law.

## 17. Suspension or Termination

We may restrict access to off-chain components of SPØR where reasonably necessary to protect users, prevent abuse, comply with law, or maintain the security of the Service.

We cannot necessarily remove or alter activity already recorded on the Solana blockchain.

You may stop using SPØR at any time.

## 18. Privacy

Our handling of personal information is described in the **SPØR Privacy Policy**, available at:

**https://sporseekerzero.fun/privacy**

## 19. Changes to These Terms

We may update these Terms as SPØR evolves.

If we make material changes, we will update the “Last updated” date and, where required, provide additional notice.

Your continued use of SPØR after updated Terms become effective constitutes acceptance to the extent permitted by applicable law.

## 20. Governing Law

These Terms are governed by the laws of **Serbia**, without prejudice to any mandatory consumer protections that apply to you under the law of your country of residence.

## 21. Contact

Questions about these Terms may be sent to:

**Djuradj Djuric**  
**djura2707@gmail.com**  
**https://sporseekerzero.fun**
`,
  },
  privacy: {
    title: "SPØR - Privacy Policy",
    description: "Privacy Policy for SPØR - Seeker Zero.",
    path: "/privacy",
    markdown: `# SPØR - Privacy Policy

**Last updated: September 29, 2026**

This Privacy Policy explains how **Djuradj Djuric** (“SPØR,” “we,” “us,” or “our”) collects, uses, shares, and protects information when you use SPØR – Seeker Zero (“SPØR” or the “Service”).

SPØR is a wallet-based application built on the Solana blockchain.

## 1. Information We Process

### Wallet information

When you connect a compatible Solana wallet, we may process information including:

- your public wallet address;
- wallet connection information;
- signatures used to authenticate you;
- authentication nonces; and
- information required to verify your authorization to use the connected wallet.

We do **not** receive or store your private keys, seed phrase, or wallet recovery phrase.

### Seeker Genesis Token information

SPØR verifies your eligibility using your Seeker Genesis Token (“SGT”).

We may process information including:

- SGT mint address;
- SGT ownership information;
- associated public wallet address; and
- other publicly available blockchain information required to verify the SGT.

Within SPØR, the SGT mint address may function as the permanent identity associated with an organism.

### Organism and blockchain information

When you use SPØR, we may process public blockchain information including:

- organism number;
- organism blockchain address;
- SGT mint;
- parent organism;
- generation;
- genome;
- birth timestamp;
- spore state;
- associated Core asset;
- transaction signatures; and
- ancestry information derived from public blockchain records.

Some of this information is written directly to the Solana blockchain.

### Authentication and session information

SPØR uses Sign In With Solana and server-side authentication.

We may process authentication information necessary to establish and maintain a secure SPØR session, including single-use nonces, cryptographic signatures, session identifiers, and hashed session-token information.

### QR scanning and camera access

SPØR may request access to your device's camera so that you can scan a SPØR QR code and claim a spore.

SPØR uses camera access for this feature only.

QR scanning is processed locally by the app. Camera image frames are not uploaded to or stored by SPØR.

### Technical information

When your device communicates with our servers, our hosting or infrastructure providers may automatically process limited technical information such as:

- IP address;
- request timestamps;
- device or application information;
- network information;
- server logs; and
- security or error information.

This information may be used to operate, secure, troubleshoot, and protect the Service.

SPØR does not require precise GPS location for its core functionality.

## 2. Information We Do Not Request

SPØR is designed to minimize personal-data collection.

SPØR does not require you to provide:

- your name;
- email address;
- phone number;
- password;
- contacts;
- precise GPS location;
- seed phrase;
- wallet private key; or
- traditional account-registration information.

If you voluntarily contact us for support, we will receive the information that you choose to provide in that communication.

## 3. How We Use Information

We use information described above to:

- authenticate your wallet;
- verify SGT eligibility;
- provide SPØR functionality;
- identify the organism associated with an SGT;
- create and verify organism births;
- display organism and bloodline information;
- index public Solana data for faster application performance;
- maintain sessions;
- prevent fraud, abuse, replay attacks, and unauthorized access;
- maintain and secure our infrastructure;
- diagnose errors and technical problems;
- comply with applicable law; and
- respond to support requests.

We do not use your wallet information to provide financial or investment advice.

## 4. Public Blockchain Data

Solana is a public blockchain.

When a SPØR transaction is submitted to Solana, information contained in that transaction may become permanently public.

This may include wallet addresses, transaction signatures, organism-related blockchain accounts, SGT information, and other data included in or derived from the transaction.

Public blockchain information can be viewed, copied, indexed, and stored by third parties independently of SPØR.

We do not control the Solana network and generally cannot alter or delete information after it has been confirmed on-chain.

You should therefore understand that blockchain information has different privacy characteristics from information stored in a conventional private database.

## 5. Off-Chain Indexed Data

SPØR may maintain an off-chain index of public organism information so that the application can load species and bloodline information efficiently.

This database is a derived representation of blockchain state. The Solana blockchain remains the authoritative source for canonical organism information.

The indexed information may include organism identifiers, SGT mint addresses, ancestry, genome information, transaction signatures, asset addresses, and timestamps.

## 6. How We Share Information

We do not sell personal information.

We may disclose or make information available to service providers when necessary to operate SPØR.

These providers may include:

### Solana network

Transactions submitted through SPØR are sent to the public Solana network and become visible to network participants and the public.

### Blockchain infrastructure providers

We may use infrastructure providers such as **Helius** to access Solana data, process RPC requests, and index blockchain activity.

### Hosting providers

Our API and web infrastructure may be hosted using providers such as **Vercel**.

### Database providers

We may use infrastructure such as **MongoDB Atlas** to store off-chain application data and indexes.

### Wallet providers

When you interact with SPØR through a compatible wallet, the wallet provider processes information according to its own privacy practices.

### Solana Mobile

If you download SPØR through the Solana dApp Store or use it on a Solana Mobile device, Solana Mobile may independently process information in accordance with its own privacy policy.

We may also disclose information when reasonably necessary to comply with applicable law, enforce our rights, investigate fraud or security incidents, or protect users and the Service.

## 7. No Sale or Targeted Advertising

SPØR does not sell your personal information.

SPØR is not designed around behavioral advertising or the sale of user profiles.

If this changes in the future, this Privacy Policy will be updated before such processing is introduced where required by law.

## 8. Legal Bases for Processing

Where laws such as the GDPR or similar data-protection legislation apply, we process personal information under one or more of the following legal bases:

- **performance of a contract**, when processing is necessary to provide SPØR to you;
- **legitimate interests**, including operating, securing, preventing abuse of, and improving the Service;
- **legal obligations**, where processing is required by applicable law; and
- **consent**, where applicable law requires consent for a particular activity.

## 9. Data Retention

We retain off-chain information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including operating the Service, maintaining security, resolving disputes, and complying with legal obligations.

Authentication and session information may be removed or invalidated when it expires, when you log out, or when it is no longer required, subject to limited security and backup retention.

Public blockchain information is different.

Information permanently recorded on Solana may remain publicly available indefinitely and cannot generally be deleted by SPØR.

Certain off-chain organism information may also be derived again from publicly available blockchain records.

## 10. Deletion Requests

You may contact us at **djura2707@gmail.com** to request deletion of personal information that we control off-chain.

Where applicable, we will delete, anonymize, or otherwise address eligible off-chain personal information in accordance with applicable law.

A deletion request cannot remove information permanently recorded on the Solana blockchain, and we cannot require independent third parties who have copied public blockchain data to delete their copies.

We will explain these limitations if they apply to a request.

## 11. Your Privacy Rights

Depending on where you live, you may have rights concerning your personal information, including the right to:

- request access to your personal information;
- request correction of inaccurate information;
- request deletion;
- restrict or object to certain processing;
- request portability of certain information;
- withdraw consent where processing is based on consent; and
- lodge a complaint with an applicable data-protection authority.

These rights may be subject to legal exceptions and may not apply to immutable public blockchain records outside our control.

To exercise a privacy right, contact **djura2707@gmail.com**.

We may need to verify that a request relates to you before completing it.

## 12. Security

We use technical and organizational measures intended to protect information handled by SPØR.

SPØR's architecture includes cryptographic wallet authentication, server-side signature verification, secure session handling, and validation of blockchain activity.

However, no network, blockchain, application, or information system can be guaranteed to be completely secure.

You are responsible for securing your device, wallet, private keys, and recovery information.

## 13. International Data Processing

Our infrastructure providers may process information in countries other than the country where you live.

Where required by applicable law, we use or rely on appropriate mechanisms intended to protect personal information transferred internationally.

## 14. Children's Privacy

SPØR is not intended for individuals under 18 years of age.

We do not knowingly collect personal information from children through SPØR.

If you believe a child has provided personal information to us, contact **djura2707@gmail.com**.

## 15. Third-Party Services

SPØR interacts with services and protocols that we do not control, including Solana, wallet applications, blockchain infrastructure providers, and Solana Mobile.

Their handling of information is governed by their own policies.

This Privacy Policy covers information processed by **Djuradj Djuric** through SPØR and does not replace the privacy policies of those third parties.

## 16. Changes to This Privacy Policy

We may update this Privacy Policy as SPØR or applicable legal requirements change.

When we update it, we will revise the “Last updated” date above.

Where required by law, we will provide additional notice of material changes.

## 17. Contact

For questions, requests, or complaints regarding privacy:

**Djuradj Djuric**  
**djura2707@gmail.com**  
**https://sporseekerzero.fun**

If applicable law requires us to provide additional company, representative, or data-protection contact information, it will be listed here.
`,
  },
  dataDeletion: {
    title: "SPØR - Data Deletion",
    description:
      "How to request deletion of off-chain personal information controlled by SPØR.",
    path: "/data-deletion",
    markdown: `# SPØR - Data Deletion

**Last updated: September 29, 2026**

You may request deletion of off-chain personal information controlled by SPØR.

Deletion requests should be sent to:

**djura2707@gmail.com**

SPØR may need to verify that the request relates to you before completing it.

Eligible off-chain personal information will be deleted, anonymized, or otherwise handled as required by applicable law.

Solana is a public blockchain. Public Solana blockchain records cannot be deleted, altered, or removed by SPØR.

This means SPØR cannot erase on-chain organisms, transactions, Seeker Genesis Token records, NFTs, or other confirmed Solana data.

Third parties may independently view, copy, index, store, or retain copies of public blockchain data.
`,
  },
} as const satisfies Record<
  "terms" | "privacy" | "dataDeletion",
  LegalDocument
>;
