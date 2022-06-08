#!/bin/bash

node inject-schema.js ../openapi.yaml ../../EPCIS-JSON-Schema.json ../query-schema.json > ../openapi.json
