import * as api from './api-client';

/**
 * Saved-address client layer (Phase 4).
 *
 * Shapes match GET/POST /api/addresses and PATCH/DELETE /api/addresses/[id]
 * exactly (the backend schema is addressCreateSchema in src/lib/cart-schemas.ts).
 * Ownership is enforced server-side — these helpers never send a userId.
 */

export interface Address {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
}

/** Payload accepted by POST/PATCH — mirrors addressCreateSchema. */
export interface AddressInput {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  pincode: string;
  isDefault?: boolean;
}

/** Raw form values (all strings, optional fields default to ''). */
export interface AddressFormValues {
  label: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export function emptyAddressFormValues(): AddressFormValues {
  return { label: '', line1: '', line2: '', city: '', state: '', pincode: '', isDefault: false };
}

export function addressToFormValues(a: Address): AddressFormValues {
  return {
    label: a.label ?? '',
    line1: a.line1,
    line2: a.line2 ?? '',
    city: a.city,
    state: a.state ?? '',
    pincode: a.pincode,
    isDefault: a.isDefault,
  };
}

/** Trim and drop empty optionals so the payload matches what the schema expects. */
export function formValuesToInput(v: AddressFormValues): AddressInput {
  const label = v.label.trim();
  const line2 = v.line2.trim();
  const state = v.state.trim();
  return {
    ...(label ? { label } : {}),
    line1: v.line1.trim(),
    ...(line2 ? { line2 } : {}),
    city: v.city.trim(),
    ...(state ? { state } : {}),
    pincode: v.pincode.trim(),
    isDefault: v.isDefault,
  };
}

/* ── Typed API calls ────────────────────────────────────────────────────── */

export async function listAddresses(): Promise<Address[]> {
  const data = await api.authenticatedFetch<{ addresses: Address[] }>('/api/addresses');
  return data.addresses;
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const data = await api.authenticatedFetch<{ address: Address }>('/api/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.address;
}

export async function updateAddress(id: string, input: Partial<AddressInput>): Promise<Address> {
  const data = await api.authenticatedFetch<{ address: Address }>(
    `/api/addresses/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) }
  );
  return data.address;
}

export async function deleteAddress(id: string): Promise<void> {
  await api.authenticatedFetch<{ ok: boolean }>(`/api/addresses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/** Best effort: pick the address to select after a deletion/edit, default first. */
export function preferredAddressId(list: Address[]): string | null {
  if (list.length === 0) return null;
  return (list.find((a) => a.isDefault) ?? list[0]).id;
}
