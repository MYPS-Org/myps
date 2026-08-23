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
  onClose,
  message,
  type = "success",
  size = "md",
  className,
  actions,
}: {
  onClose: () => void;
  message: string;
  type?: keyof typeof typeStyles;
  size?: keyof typeof sizes;
  className?: string;
  timeOut?: number;
  actions?: { label: string; href: string }[];
}) {
  const styles = typeStyles[type];

  return (
    <div
      className={clsx(
        "rounded-md p-4 shadow-md transition-all mb-2",
        styles.bg,
        sizes[size],
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {type === "success" && <CheckCircleIcon className={clsx("size-6", styles.icon)} />}
        {type === "error" && <XCircleIcon className={clsx("size-6", styles.icon)} />}
        {type === "info" && <InformationCircleIcon className={clsx("size-6", styles.icon)} />}
        {type === "warning" && <ExclamationCircleIcon className={clsx("size-6", styles.icon)} />}
        <p className={clsx("text-sm font-medium flex-1", styles.text)}>{message}</p>
        <button
          onClick={onClose}
          className={clsx(
            "inline-flex rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2 hover:bg-black/5",
            styles.ring
          )}
        >
          <XMarkIcon className={clsx("size-5", styles.text)} />
        </button>
      </div>
      {actions && actions.length > 0 && (
        <div className="mt-2 pl-9 flex flex-col gap-1 items-start">
          {actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className={clsx("text-sm font-semibold underline", styles.text)}
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
