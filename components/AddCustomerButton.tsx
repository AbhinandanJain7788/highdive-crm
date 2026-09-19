"use client";

import { useState } from "react";
import AddCustomerModal from "@/components/AddCustomerModal";

// Lives in the Topbar (every screen) so a customer can be added from anywhere,
// not just the Customers page's own "+ Add Customer" button.
export default function AddCustomerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "#FF5C35",
          border: "none",
          color: "#FFFFFF",
          borderRadius: 6,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        + Add Customer
      </button>
      {open && <AddCustomerModal onClose={() => setOpen(false)} onCreated={() => window.location.reload()} />}
    </>
  );
}
