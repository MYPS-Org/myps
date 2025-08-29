import * as Headless from "@headlessui/react";
import clsx from "clsx";
import { CheckCircleIcon, InformationCircleIcon, XMarkIcon, ExclamationCircleIcon, XCircleIcon } from "@heroicons/react/16/solid";

const typeStyles = {
  success: {
    bg: "bg-green-100",
    text: "text-green-700",
    icon: "text-green-500",
    ring: "focus-visible:ring-green-500",
  },
  error: {
    bg: "bg-red-100",
    text: "text-red-700",
    icon: "text-red-500",
    ring: "focus-visible:ring-red-500",
  },
  info: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: "text-blue-500",
    ring: "focus-visible:ring-blue-500",
  },
  warning: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    icon: "text-yellow-500",
    ring: "focus-visible:ring-yellow-500",
  },
};

const sizes = {
  xs: "sm:max-w-xs",
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
};

export function Toaster({
  open,
  onClose,
  message,
  type = "success",
  size = "md",
  className,
  timeOut = 3000,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
  type?: keyof typeof typeStyles;
  size?: keyof typeof sizes;
  className?: string;
  timeOut: number;
}) {
  const styles = typeStyles[type];

  return (
    <Headless.Dialog open={open} onClose={onClose} className="fixed inset-0 z-50">
      <div className="flex items-end justify-end p-6">
        <div
          className={clsx(
            "flex items-center gap-3 rounded-md p-4 shadow-md transition-all",
            styles.bg,
            sizes[size],
            className,
          )}
        >
          {type === "success" && <CheckCircleIcon className={clsx("size-6", styles.icon)} />}
          {type === "error" && <XCircleIcon className={clsx("size-6", styles.icon)} />}
          {type === "info" && <InformationCircleIcon className={clsx("size-6", styles.icon)} />}
          {type === "warning" && <ExclamationCircleIcon className={clsx("size-6", styles.icon)} />}
          <p className={clsx("text-sm font-medium", styles.text)}>{message}</p>
          <button
            onClick={onClose}
            className={clsx(
              "ml-auto inline-flex rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2",
              styles.ring
            )}
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>
      </div>
    </Headless.Dialog>
  );
}
