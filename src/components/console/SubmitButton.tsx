"use client";

import { useFormStatus } from "react-dom";
import { btnCls } from "./ui";

/** Submit button that shows a pending state while its <form action> runs. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className = "",
  confirm,
  disabled,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  className?: string;
  confirm?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      onClick={
        confirm
          ? (e) => {
              if (!window.confirm(confirm)) e.preventDefault();
            }
          : undefined
      }
      className={`${btnCls(variant, size)} disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}
