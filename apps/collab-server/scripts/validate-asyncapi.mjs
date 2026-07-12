import { Parser, fromFile } from "@asyncapi/parser";

const specification = "../../docs/tech/asyncapi/sketchblock-collab.asyncapi.yaml";
const parser = new Parser();
const { document, diagnostics } = await fromFile(parser, specification).parse();

for (const diagnostic of diagnostics) {
  const location = diagnostic.range
    ? `${diagnostic.range.start.line + 1}:${diagnostic.range.start.character + 1}`
    : "unknown";
  const rule = diagnostic.code ? ` (${diagnostic.code})` : "";
  console.log(`${specification}:${location} ${diagnostic.message}${rule}`);
}

const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 0);

if (!document || errors.length > 0) {
  console.error(`AsyncAPI validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("AsyncAPI specification is valid.");
