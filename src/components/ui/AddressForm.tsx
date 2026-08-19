'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import {
  addressToFormValues,
  emptyAddressFormValues,
  type Address,
  type AddressFormValues,
} from '@/lib/addresses';
import { ApiClientError } from '@/lib/api-client';

interface AddressFormProps {
  /** When provided the form edits this address, otherwise it creates a new one. */
  initial?: Address;
  submitLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  /** Called with the final values; should perform the API call and throw on failure. */
  onSubmit: (values: AddressFormValues) => Promise<void>;
  onCancel?: () => void;
}

/** Field-level validation mirroring addressCreateSchema (server validates again). */
function validate(values: AddressFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.label.trim().length > 40) errors.label = 'Label must be 40 characters or fewer';
  if (values.line1.trim().length < 2) errors.line1 = 'Address line 1 is required';
  if (values.line1.trim().length > 200) errors.line1 = 'Address line 1 is too long';
  if (values.line2.trim().length > 200) errors.line2 = 'Address line 2 is too long';
  if (!values.city.trim()) errors.city = 'City is required';
  if (values.city.trim().length > 80) errors.city = 'City is too long';
  if (values.state.trim().length > 80) errors.state = 'State is too long';
  if (!/^\d{6}$/.test(values.pincode.trim()))
    errors.pincode = 'Pincode must be a 6-digit number';
  return errors;
}

const inputClass =
  'w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary bg-secondary text-foreground placeholder:text-muted-foreground';
const errorClass = 'text-xs text-red-600 font-semibold mt-1';

export default function AddressForm({
  initial,
  submitLabel = 'Save Address',
  cancelLabel = 'Cancel',
  busy = false,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const [values, setValues] = useState<AddressFormValues>(
    initial ? addressToFormValues(initial) : emptyAddressFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof AddressFormValues, value: string | boolean) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || submitting) return;
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setServerError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setServerError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not save the address. Please try again.'
      );
      setSubmitting(false);
    }
  };

  const isBusy = busy || submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <input
            type="text"
            placeholder="Label (Home, Work…)"
            value={values.label}
            onChange={(e) => set('label', e.target.value)}
            className={inputClass}
            maxLength={40}
          />
        </div>
        <div className="sm:col-span-2">
          <input
            type="text"
            placeholder="Address line 1 (flat, building, street)"
            value={values.line1}
            onChange={(e) => set('line1', e.target.value)}
            className={inputClass}
            maxLength={200}
          />
          {fieldErrors.line1 && <p className={errorClass}>{fieldErrors.line1}</p>}
        </div>
      </div>

      <input
        type="text"
        placeholder="Address line 2 (optional — area, landmark)"
        value={values.line2}
        onChange={(e) => set('line2', e.target.value)}
        className={inputClass}
        maxLength={200}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <input
            type="text"
            placeholder="City"
            value={values.city}
            onChange={(e) => set('city', e.target.value)}
            className={inputClass}
            maxLength={80}
          />
          {fieldErrors.city && <p className={errorClass}>{fieldErrors.city}</p>}
        </div>
        <div>
          <input
            type="text"
            placeholder="State (optional)"
            value={values.state}
            onChange={(e) => set('state', e.target.value)}
            className={inputClass}
            maxLength={80}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Pincode (6 digits)"
            value={values.pincode}
            onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={inputClass}
          />
          {fieldErrors.pincode && <p className={errorClass}>{fieldErrors.pincode}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={values.isDefault}
            onChange={(e) => set('isDefault', e.target.checked)}
            className="w-4 h-4 accent-[rgb(var(--primary))]"
          />
          Set as default
        </label>
      </div>

      {serverError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-3 py-2.5">
          <Icon name="ExclamationTriangleIcon" size={16} className="shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isBusy}
          className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:bg-accent transition-colors btn-spring disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {isBusy && (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isBusy}
            className="px-4 py-2 bg-secondary text-foreground font-semibold text-sm rounded-lg hover:bg-muted transition-colors disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}
