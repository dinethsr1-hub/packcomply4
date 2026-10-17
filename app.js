require("dotenv").config();
const express = require("express");
const multer = require("multer");
const OpenAI = require("openai");
const path = require("path");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

app.use(express.json());
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use(express.static(path.join(__dirname, "public")));

const RULES = require("./rules.json");
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function matches(rule, x) {
  const t = rule.trigger || {};
  if (t.all) return true;
  if (t.country && t.country !== x.country) return false;
  if (t.countries && !t.countries.includes(x.country)) return false;
  if (t.product && t.product !== x.product) return false;
  if (t.products && !t.products.includes(x.product)) return false;
  if (t.food_contact && t.food_contact !== x.food_contact) return false;
  if (t.b2c && t.b2c !== x.b2c) return false;
  if (t.foreign_direct && t.foreign_direct !== x.foreign_direct) return false;
  if (t.material && !t.material.includes(x.material)) return false;
  return true;
}

app.post("/api/check", (req, res) => {
  const x = req.body || {};
  const normalized = {...x};
  const foodProducts = ["food","cinnamon","tea","coconut","coffee","spices","mushrooms"];
  if (foodProducts.includes(normalized.product)) normalized.product = normalized.product === "food" ? "food" : normalized.product;
  const matched = RULES.filter(r => {
    const t = r.trigger || {};
    if (t.product === "food" && foodProducts.includes(x.product)) {
      const copy = {...r, trigger:{...t, product:x.product}};
      return matches(copy, x);
    }
    return matches(r, x);
  });
  const evidence = [...new Set(matched.flatMap(r => r.evidence || []))];

  const issues = [];
  if (!x.product || !x.country || !x.material) issues.push("Complete the product, destination and packaging fields.");
  if (x.food_contact === "yes") {
    issues.push("Food-contact suitability should be supported by supplier documentation and intended-use information.");
  }
  if (x.material === "plastic" || x.material === "composite") {
    issues.push("Exact polymer/layer structure cannot be established from appearance alone.");
  }
  if (x.mass === "unknown") issues.push("Packaging mass is missing; obtain the packaging weight in kg.");
  if (x.b2c === "yes" && x.country === "Germany") {
    issues.push("Check German packaging EPR/LUCID obligations for the actual producer role and packaging classification.");
  }

  const high = matched.filter(r => r.priority === "high").length;
  const status = issues.length || high ? "CHECK REQUIRED" : "PRELIMINARY REVIEW";
  const risk = issues.length >= 4 ? "HIGH" : issues.length >= 2 || high >= 3 ? "MEDIUM" : "LOW";
  res.json({
    status,
    risk,
    matched,
    evidence,
    issues,
    limitations: [
      "This is a preliminary screening tool, not legal advice, certification or a binding compliance determination.",
      "A photograph cannot prove polymer composition, migration compliance, recyclability classification or legal conformity.",
      "Rules can change; users should verify the linked official source and the current applicability to their role and product."
    ]
  });
});

app.post("/api/inspect", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

  if (!client) {
    return res.json({
      mode: "demo",
      inspection: {
        packaging_type: "Flexible pouch",
        likely_material: "Plastic / multilayer (unverified)",
        material_confidence: "low",
        food_contact_likelihood: "likely",
        visible_text: [],
        visible_symbols: [],
        possible_issues: [
          "Exact polymer/layer structure cannot be verified from a photo.",
          "Food-contact compliance cannot be established from appearance alone."
        ],
        missing_information: [
          "Material specification",
          "Packaging weight",
          "Food-contact Declaration of Compliance where applicable"
        ],
        cannot_determine: [
          "Polymer composition",
          "Migration compliance",
          "Recyclability classification"
        ],
        confidence: "low"
      }
    });
  }

  try {
    const b64 = req.file.buffer.toString("base64");
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: [{
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Inspect this packaging photo as a preliminary packaging-compliance assistant. Return JSON only with keys: packaging_type, likely_material, material_confidence, food_contact_likelihood, visible_text, visible_symbols, possible_issues, missing_information, cannot_determine, confidence. Do not claim legal compliance. Never infer exact polymer composition, migration compliance, certification validity, or legal responsibility from appearance alone.`
          },
          { type: "input_image", image_url: `data:${req.file.mimetype};base64,${b64}` }
        ]
      }]
    });
    let parsed;
    try { parsed = JSON.parse(response.output_text || "{}"); }
    catch { parsed = { raw: response.output_text || "" }; }
    res.json({ mode: "live", inspection: parsed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;
