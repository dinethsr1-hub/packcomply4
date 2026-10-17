# PackComply V4 — Export Compliance Starter

A free preliminary export-compliance screening MVP.

## Current verified starter scope
- EU/Germany/France/Netherlands food + packaging screening
- Cinnamon-specific dried-spice PAH and pesticide-residue screening
- Food information/labelling framework
- EU official controls and enhanced-control screening flag
- Food-contact materials: general framework, plastic materials, GMP
- EU Packaging and Packaging Waste Regulation screening
- Germany LUCID / EPR screening

## Important limitation
Country and product dropdowns are broader than the verified rule database. The app deliberately reports limited coverage rather than inventing requirements. Before commercial use, each country/product combination must be populated and reviewed against current official sources.

## Deployment
Vercel can deploy the Express app through the existing `api/index.js` / `vercel.json` setup used by the working repository. No API key is required for the demo photo inspection.
