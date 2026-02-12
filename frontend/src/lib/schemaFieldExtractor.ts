/**
 * Schema Field Extractor
 *
 * Extracts custom field metadata from pipeline config schemas for dynamic rendering.
 * Filters out hardcoded fields that have dedicated UI controls.
 */

import type { SchemaFieldMetadata } from "../types";
import type { PipelineConfigSchema, PipelineSchemaProperty } from "./api";

// Hardcoded fields that have dedicated UI controls (don't render dynamically)
const HARDCODED_FIELDS = [
  'height',
  'width',
  'seed',
  'denoising_steps',
  'vae_type',
  'noise_scale',
  'noise_controller',
  'manage_cache',
  'kv_cache_attention_bias',
  'quantization',
  'ref_images',
  'vace_context_scale',
  'input_size',
  'ctrl_input',
  'images',
  'base_seed', // Alias for seed
];

/**
 * Extract custom schema fields for dynamic rendering
 *
 * @param configSchema - The pipeline's config_schema object
 * @param excludeFields - Additional fields to exclude (optional)
 * @returns Record of field names to metadata
 */
export function extractCustomSchemaFields(
  configSchema: PipelineConfigSchema | undefined,
  excludeFields: string[] = []
): Record<string, SchemaFieldMetadata> {
  if (!configSchema || !configSchema.properties) {
    return {};
  }

  const customFields: Record<string, SchemaFieldMetadata> = {};
  const allExcludedFields = new Set([...HARDCODED_FIELDS, ...excludeFields]);

  for (const [fieldName, property] of Object.entries(configSchema.properties)) {
    // Skip hardcoded and excluded fields
    if (allExcludedFields.has(fieldName)) {
      continue;
    }

    // Extract metadata from property
    const metadata = extractFieldMetadata(
      fieldName,
      property,
      configSchema.$defs
    );

    if (metadata) {
      customFields[fieldName] = metadata;
    }
  }

  return customFields;
}

/**
 * Extract metadata for a single field property
 */
function extractFieldMetadata(
  fieldName: string,
  property: PipelineSchemaProperty,
  defs?: Record<string, { enum?: unknown[] }>
): SchemaFieldMetadata | null {
  // Handle $ref (enum types in Pydantic v2)
  if (property.$ref && defs) {
    const refPath = property.$ref;
    const defName = refPath.split("/").pop();
    const definition = defs[defName || ""];

    if (definition?.enum) {
      return {
        name: fieldName,
        type: 'enum',
        default: property.default,
        description: property.description,
        enumValues: definition.enum,
      };
    }
  }

  // Determine base type
  let type: SchemaFieldMetadata['type'];

  switch (property.type) {
    case 'boolean':
      type = 'boolean';
      break;
    case 'integer':
      type = 'integer';
      break;
    case 'number':
      type = 'number';
      break;
    case 'string':
      // Check if it's an enum (inline enum without $ref)
      if (property.enum) {
        type = 'enum';
        break;
      }
      type = 'string';
      break;
    default:
      // Skip unsupported types (arrays, objects, etc.)
      return null;
  }

  return {
    name: fieldName,
    type,
    default: property.default,
    description: property.description,
    minimum: property.minimum,
    maximum: property.maximum,
    enumValues: property.enum,
    // Derive step from constraints or use sensible defaults
    step: deriveStep(type, property.minimum, property.maximum),
  };
}

/**
 * Derive appropriate step value for numeric inputs
 */
function deriveStep(
  type: string,
  minimum?: number,
  maximum?: number
): number | undefined {
  if (type === 'integer') {
    return 1;
  }

  if (type === 'number') {
    // For floats, use 0.1 as default step
    // If range is very small (< 1), use 0.01
    if (minimum !== undefined && maximum !== undefined) {
      const range = maximum - minimum;
      if (range < 1) {
        return 0.01;
      }
    }
    return 0.1;
  }

  return undefined;
}
