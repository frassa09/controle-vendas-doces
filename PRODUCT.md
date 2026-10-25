# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

The store app is a native Android app. The customer page is a separate mobile-first web surface (a browser on the customer's phone), and its surface brief should be treated as `web`.

## Stack

Expo (React Native) for the Android store app, distributed as an APK outside the Play Store; Vite + React for the customer web page, hosted on Vercel's free tier; Supabase free tier (Postgres, Auth, RLS, Edge Functions) as the backend. Monorepo with a shared domain package (`core`) that both front ends call. Hard constraint: nothing that requires a paid subscription or per-transaction fees.

## Users

- **Store members (primary operators):** the owner and one other person who sells with them. Both have identical permissions and act "as the same person". They use the app on Android phones, standing in front of a customer during an in-person sale, often in a hurry. Jobs: register a sale in under 10 seconds, record payments (often partial), chase customers who owe money, configure the loyalty rules, read business metrics.
- **Customers:** a mixed audience (coworkers, students, neighbours) of varied ages who buy in person and mostly pay by Pix, sometimes in cash. They open a personal link on their own phone, with no app to install and no account. Jobs: see what they owe and pay it, see their points, redeem rewards, play the scratch card.

## Product Purpose

Gives a small homemade-sweets business (best seller: brownie) control over sales on credit ("fiado"), effortless collection of debts, a loyalty program that brings customers back and nudges them to pay, and metrics for deciding what to make and sell. Success means that no debt is forgotten, collection takes minutes instead of awkward conversations, and customers return because the loyalty page is something they enjoy opening.

## Positioning

Built for an informal, in-person, credit-heavy sweets business rather than a generic POS: debts and collection are first-class. Points are credited only once a purchase is paid, so the loyalty program itself pays down debt. Collection runs as a one-tap WhatsApp queue with a Pix copy-and-paste code that already carries the exact amount. The loyalty program is a customer-chosen mix of a guaranteed free product and a server-drawn scratch card, at zero running cost.

## Operating Context

- Sales happen only in person. Payment is Pix (most common) or cash. Cards are not accepted. Credit sales and partial payments are common.
- Prices are mostly fixed, with occasional price cuts and "X for Y" combos.
- Up to about 50 customers per week today, with plans to grow.
- Communication with customers happens over WhatsApp, sent from each member's own phone through prefilled `wa.me` links. Members confirm Pix payments manually by checking their bank app.
- The app is online-only.
- The store's own name, logo, primary color and welcome text are chosen inside the app when the store is created (multi-store architecture). Any visual identity must therefore work with a variable store name and a variable brand color.

## Capabilities and Constraints

- Full functional spec: GitHub issue #1 (https://github.com/frassa09/controle-vendas-doces/issues/1).
- **Store app:** store setup and invite code; products and combos (with price, points generated and a "can be a prize" flag); customers (name, WhatsApp, reference, PIN, notes, LGPD consent); quick sale; payments; edit or cancel with history kept; collection queue; receipts; coupon delivery; a full metrics page; CSV/Excel backup export.
- **Customer page:** opened by a secret link. Points are shown as stamps, alongside what the customer owes with a Pix code, their history and pending coupons. Redeeming and playing the scratch card require the customer's 4-digit PIN. The scratch card has two visual formats (5 areas, or match 3), both with the same server-drawn odds. The prize is a product the customer picks from the store's prize-eligible list.
- **Terminology (pt-BR):** venda, fiado, pagamento, saldo devedor, cobrança, pontos/carimbos, resgate, raspadinha, cupom, loja, cliente.
- **UI language:** Brazilian Portuguese.
- **Undecided:** store/brand name (none yet), logo, colors.

## Brand Commitments

- **Voice:** warm and homemade ("carinhoso e caseiro"). Close and affectionate, as someone who knows the customer by name. Collection messages remind without embarrassing the customer.
- **Name, logo and visual identity:** none exist yet. The store name is set by the user at store creation.

## Evidence on Hand

None yet: no photos of the products, no logo, no testimonials and no real sales data. Future work must not fabricate customer quotes, sales figures or product photos presented as real.

## Product Principles

1. **The counter is sacred.** Any flow used in front of a customer must be fast enough not to interrupt the sale.
2. **Money must always be right.** Balances, points and refunds are derived and auditable, never hand-edited, and nothing is ever deleted.
3. **Collect without embarrassing.** Collecting a debt should feel like a friendly reminder that makes paying effortless.
4. **Loyalty is a treat.** The customer page should feel like a small gift worth opening, because its job is to make people want to buy again.
5. **Zero running cost.** Prefer free, manual-but-quick solutions over paid automation.

## Accessibility & Inclusion

No product-specific requirement beyond good practice: readable contrast, legible text sizes and large touch targets. Note that the customer audience spans varied ages.
