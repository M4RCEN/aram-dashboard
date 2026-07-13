"use client";

type ToastProps = {
  type: "success" | "error";
  message: string;
  onClose?: () => void;
};

export default function Toast({ type, message, onClose }: ToastProps) {
  return (
    <div
      className={`fixed right-6 top-6 z-[60] flex items-center gap-3 rounded-xl px-5 py-4 text-sm font-semibold text-white shadow-lg ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span>{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-2 rounded-lg bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30"
        >
          ✕
        </button>
      )}
    </div>
  );
}
