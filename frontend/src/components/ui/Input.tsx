import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = "", ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-cream-muted mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-helper`
                : undefined
          }
          aria-invalid={error ? "true" : undefined}
          className={[
            "block w-full rounded-md border px-3 py-2 text-sm bg-navy-800 text-cream",
            "placeholder:text-cream-subtle focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:bg-navy-700 disabled:text-cream-subtle disabled:cursor-not-allowed",
            error
              ? "border-red-700/50 text-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-navy-700 focus:border-purple focus:ring-purple/50",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-red-400">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={`${inputId}-helper`}
            className="mt-1 text-sm text-cream-subtle"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
