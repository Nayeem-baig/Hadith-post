import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "destructive" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-[var(--gold)] text-[#1a1200] hover:bg-[var(--gold-soft)]",
      secondary: "bg-[#16202a] text-[#e8e8e8] hover:bg-[#1c2834]",
      ghost: "bg-transparent text-[#e8e8e8] hover:bg-white/5",
      destructive: "bg-[#5f1a1a] text-white hover:bg-[#7a2424]",
      outline: "border border-[var(--panel-border)] bg-transparent text-[#e8e8e8] hover:border-[var(--gold)]"
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-xs",
      lg: "h-11 px-5",
      icon: "h-10 w-10"
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
