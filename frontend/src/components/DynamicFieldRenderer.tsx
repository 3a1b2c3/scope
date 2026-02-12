import { useState } from "react";
import { Toggle } from "./ui/toggle";
import { SliderWithInput } from "./ui/slider-with-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { useLocalSliderValue } from "../hooks/useLocalSliderValue";
import type { SchemaFieldMetadata } from "../types";

interface DynamicFieldRendererProps {
  field: SchemaFieldMetadata;
  value: unknown;
  onChange: (fieldName: string, value: unknown) => void;
  onCommit?: (fieldName: string, value: unknown) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

/**
 * Dynamic field renderer that renders appropriate UI controls based on schema field type.
 * Supports boolean, integer, number, string, and enum types.
 */
export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  onCommit,
  disabled = false,
}: DynamicFieldRendererProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validation helper for numeric fields
  const validateNumeric = (newValue: number): boolean => {
    if (field.minimum !== undefined && newValue < field.minimum) {
      setValidationError(`Must be at least ${field.minimum}`);
      return false;
    }
    if (field.maximum !== undefined && newValue > field.maximum) {
      setValidationError(`Must be at most ${field.maximum}`);
      return false;
    }
    setValidationError(null);
    return true;
  };

  // Boolean field → Toggle
  if (field.type === "boolean") {
    const boolValue = value !== undefined ? (value as boolean) : (field.default as boolean ?? false);

    return (
      <Toggle
        pressed={boolValue}
        onPressedChange={(pressed) => {
          onChange(field.name, pressed);
          onCommit?.(field.name, pressed);
        }}
        variant="outline"
        size="sm"
        className="h-7"
        disabled={disabled}
      >
        {boolValue ? "ON" : "OFF"}
      </Toggle>
    );
  }

  // Numeric fields (integer/number) → SliderWithInput
  if (field.type === "integer" || field.type === "number") {
    const numValue = value !== undefined ? (value as number) : (field.default as number ?? 0);
    const decimalPlaces = field.type === "number" ? 2 : 0;

    // Use local slider state for immediate feedback
    const sliderHook = useLocalSliderValue(
      numValue,
      (v) => {
        validateNumeric(v);
        onChange(field.name, v); // Update settings state
        onCommit?.(field.name, v); // Optional backend-specific handling
      },
      decimalPlaces
    );

    return (
      <div className="space-y-1">
        <SliderWithInput
          value={sliderHook.localValue}
          onValueChange={(v) => {
            sliderHook.handleValueChange(v);
            // Don't call onChange during drag - only on commit for efficiency
          }}
          onValueCommit={(v) => {
            sliderHook.handleValueCommit(v);
            // onChange is called by the hook's commit callback
          }}
          min={field.minimum ?? 0}
          max={field.maximum ?? 100}
          step={field.step ?? (field.type === "integer" ? 1 : 0.1)}
          incrementAmount={field.step ?? (field.type === "integer" ? 1 : 0.1)}
          disabled={disabled}
          labelClassName="text-sm text-foreground w-20"
          valueFormatter={sliderHook.formatValue}
          inputParser={(v) => {
            const parsed = field.type === "integer" ? parseInt(v) : parseFloat(v);
            return isNaN(parsed) ? (field.default as number ?? 0) : parsed;
          }}
        />
        {validationError && (
          <p className="text-xs text-red-500">{validationError}</p>
        )}
      </div>
    );
  }

  // Enum fields → Select dropdown
  if (field.type === "enum" && field.enumValues && field.enumValues.length > 0) {
    const enumValue = value !== undefined ? String(value) : String(field.default ?? field.enumValues[0]);

    return (
      <Select
        value={enumValue}
        onValueChange={(v) => {
          onChange(field.name, v);
          onCommit?.(field.name, v);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[140px] h-7">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.enumValues.map((val) => (
            <SelectItem key={String(val)} value={String(val)}>
              {String(val)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // String fields → Text input
  if (field.type === "string") {
    const strValue = value !== undefined ? String(value) : String(field.default ?? "");

    return (
      <Input
        type="text"
        value={strValue}
        onChange={(e) => {
          onChange(field.name, e.target.value);
          onCommit?.(field.name, e.target.value);
        }}
        disabled={disabled}
        className="h-8"
      />
    );
  }

  // Unknown field type - log warning and render nothing
  console.warn(`DynamicFieldRenderer: Unsupported field type "${field.type}" for field "${field.name}"`);
  return null;
}
