"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

/** A labelled row with an optional explanation, used throughout the settings. */
export function Field({
  label,
  hint,
  value,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  value?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-3.5", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.8125rem] font-medium text-ink-muted">
            {label}
          </span>
          {hint && (
            <Hint label={hint}>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="rounded-full p-0.5 text-ink-faint/70 transition-colors hover:text-ink-muted"
              >
                <Info className="size-3" />
              </button>
            </Hint>
          )}
        </div>
        <div className="flex items-center gap-3">
          {value !== undefined && (
            <span className="tabular text-xs text-ink">{value}</span>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  hint?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </Field>
  );
}

export function SliderField({
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  hint?: React.ReactNode;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="py-3">
      <Field label={label} hint={hint} value={display} className="py-0" />
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => onChange(next)}
        aria-label={label}
        className="mt-1"
      />
    </div>
  );
}

export function FieldGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-white/[0.06]", className)}>{children}</div>
  );
}
