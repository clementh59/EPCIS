/* Injects on the Open API Spec the schema definitions from the EPCIS JSON Schema */

import process from "process";
import fs from "fs";
import yaml from "js-yaml";
import fetch from "sync-fetch";

/*  Translation table so that certain JSON Schema definitions are translated
 *  to the Open API compatible definitions
 */
const definitionTranslations = {
  "EPCIS-Document-Event": "EPCISEvent",
  "@context": "LDContext",
};

/* Definitions that will not be included for OpenAPI Compatibility */
const definitionsBlackList = ["EPCIS-Document-Event", "@context"];

// The JSON Schema elements that are not to be included
const schemaBlackList = ["propertyNames"];

const EPCIS_JSON_SCHEMA = "JSON-Schema-Stub.json";

function loadJson(fileName) {
  return JSON.parse(fs.readFileSync(fileName, "utf8"));
}

function loadYaml(fileName) {
  return yaml.load(fs.readFileSync(fileName, { encoding: "utf-8" }));
}

function inject(fileName, schemaFileName, schemaFileName2) {
  const spec = loadYaml(fileName);
  const schemaFiles = [schemaFileName, schemaFileName2];

  const schemas = spec.components.schemas;

  for (const schemaFile of schemaFiles) {
    const schemaJson = loadJson(schemaFile);

    const definitions = schemaJson.definitions;

    const definitionList = Object.keys(definitions);
    for (const definition of definitionList) {
      if (!definitionsBlackList.includes(definition)) {
        schemas[definition] = definitions[definition];
      }
    }
  }

  const members = Object.keys(spec);
  for (const member of members) {
    visit(spec[member], member, spec);
  }

  return spec;
}

function visit(obj, parentKeyName, parent) {
  if (!obj || typeof obj !== "object") {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      visit(item, null, obj);
    }
    return;
  }

  const keys = Object.keys(obj);
  for (const key of keys) {
    if (key === "$ref") {
      const pointer = obj[key];
      if (pointer.startsWith("#/definitions")) {
        obj[key] = `#/components/schemas/${getDefinitionName(obj[key])}`;
      } else if (!pointer.startsWith("#")) {
        // Here there is a Reference to an example or to an schema
        if (parentKeyName === "example") {
          // The example is just inlined
          const example = loadExample(pointer);
          parent[parentKeyName] = example;
        } else if (pointer.includes(EPCIS_JSON_SCHEMA)) {
          // We just reference the schema
          obj[key] = `#/components/schemas/${getDefinitionName(obj[key])}`;
        }
      }
    } else if (schemaBlackList.includes(key)) {
      delete obj[key];
    } else {
      visit(obj[key], key, obj);
    }
  }
}

function getDefinitionName(reference) {
  const components = reference.split("/");
  let result = components[components.length - 1];
  if (definitionTranslations[result]) {
    result = definitionTranslations[result];
  }

  return result;
}

function loadExample(uri) {
  let example;
  const response = fetch(uri);

  if (response.ok) {
    if (response.headers.get("content-type").includes("json")) {
      example = response.json();
    } else if (response.headers.get("content-type").includes("xml")) {
      example = response.text();
    }
  } else {
    console.error("Cannot load example: ", uri);
  }

  return example;
}

function main() {
  const inputFile = process.argv[2];
  const schemaFile = process.argv[3];
  const schemaFile2 = process.argv[3];

  const finalSpec = inject(inputFile, schemaFile, schemaFile2);

  console.log(JSON.stringify(finalSpec, null, 2));
}

main();
