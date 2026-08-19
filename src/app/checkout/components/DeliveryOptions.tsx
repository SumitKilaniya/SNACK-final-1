'use client';
import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AddressForm from '@/components/ui/AddressForm';
import type { Address, AddressFormValues } from '@/lib/addresses';

interface DeliveryOptionsProps {
  addresses: Address[];
  /** True while GET /api/addresses is still in flight. */
  loading: boolean;
  selectedAddressId: string | null;
  onSelectAddress: (id: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  /** Performs POST /api/addresses, refreshes the list, and throws on failure. */
  onCreateAddress: (values: AddressFormValues) => Promise<void>;
  /** Performs PATCH /api/addresses/[id], refreshes the list, and throws on failure. */
  onUpdateAddress: (id: string, values: AddressFormValues) => Promise<void>;
  /** Performs DELETE /api/addresses/[id], refreshes the list, and throws on failure. */
  onDeleteAddress: (id: string) => Promise<void>;
}

function AddressCard({
  address,
  selected,
  onSelect,
  onEdit,
  onDelete,
  editForm,
}: {
  address: Address;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editForm: React.ReactNode;
}) {
  const addressLine = [address.line1, address.line2].filter(Boolean).join(', ');
  const location = [address.city, address.state].filter(Boolean).join(', ');
  return (
    <div>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
          selected ? 'border-primary bg-orange-50' : 'border-border hover:border-muted-foreground'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
              selected ? 'border-primary' : 'border-border'
            }`}
          >
            {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-sm font-bold text-foreground">
                {address.label || 'Address'}
              </span>
              {address.isDefault && (
                <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">
                  Default
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {addressLine}, {location} — {address.pincode}
            </p>
          </div>
        </div>
      </button>
      {/* Row actions */}
      <div className="flex items-center gap-1 mt-1.5 pl-7">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
        >
          <Icon name="PencilIcon" size={12} />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Icon name="TrashIcon" size={12} />
          Delete
        </button>
      </div>
      {editForm}
    </div>
  );
}

export default function DeliveryOptions({
  addresses,
  loading,
  selectedAddressId,
  onSelectAddress,
  notes,
  onNotesChange,
  onCreateAddress,
  onUpdateAddress,
  onDeleteAddress,
}: DeliveryOptionsProps) {
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const hasSelection = selectedAddressId !== null && addresses.some((a) => a.id === selectedAddressId);

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-base font-extrabold text-foreground">Delivery Address</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Where should we deliver your order?
        </p>
      </div>

      <div className="p-5 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
            <span>Loading your saved addresses…</span>
          </div>
        ) : addresses.length === 0 ? (
          <div className="p-4 border-2 border-dashed border-border rounded-xl">
            <p className="text-sm font-bold text-foreground mb-1">No saved addresses yet</p>
            <p className="text-xs text-muted-foreground mb-3">
              Add a delivery address to continue with your order.
            </p>
            <AddressForm
              submitLabel="Save & Use Address"
              onSubmit={onCreateAddress}
            />
          </div>
        ) : (
          <>
            {addresses.map((addr) => (
              <AddressCard
                key={addr.id}
                address={addr}
                selected={selectedAddressId === addr.id}
                onSelect={() => onSelectAddress(addr.id)}
                onEdit={() => setEditingId(editingId === addr.id ? null : addr.id)}
                onDelete={() => void onDeleteAddress(addr.id)}
                editForm={
                  editingId === addr.id ? (
                    <div className="mt-2 p-4 border border-border rounded-xl bg-secondary/40">
                      <p className="text-sm font-bold text-foreground mb-3">Edit Address</p>
                      <AddressForm
                        initial={addr}
                        submitLabel="Save Changes"
                        onCancel={() => setEditingId(null)}
                        onSubmit={(values) => onUpdateAddress(addr.id, values).then(() => setEditingId(null))}
                      />
                    </div>
                  ) : null
                }
              />
            ))}

            {!hasSelection && (
              <p className="text-xs text-red-600 font-semibold">
                Please choose a delivery address to place your order.
              </p>
            )}

            {!addingNew ? (
              <button
                type="button"
                onClick={() => setAddingNew(true)}
                className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm font-semibold text-primary hover:border-primary transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="PlusIcon" size={16} />
                Add New Address
              </button>
            ) : (
              <div className="p-4 border border-border rounded-xl">
                <p className="text-sm font-bold text-foreground mb-3">New Address</p>
                <AddressForm
                  submitLabel="Save Address"
                  cancelLabel="Cancel"
                  onCancel={() => setAddingNew(false)}
                  onSubmit={(values) => onCreateAddress(values).then(() => setAddingNew(false))}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Special instructions */}
      <div className="px-5 pb-5">
        <label
          htmlFor="checkout-notes"
          className="block text-sm font-bold text-foreground mb-2"
        >
          Special Instructions
        </label>
        <textarea
          id="checkout-notes"
          placeholder="Any special requests? (e.g. extra spicy, no onions)"
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          maxLength={500}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-primary bg-secondary text-foreground placeholder:text-muted-foreground resize-none"
        />
      </div>
    </div>
  );
}
