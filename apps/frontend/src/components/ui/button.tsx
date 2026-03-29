import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, FC } from "react";
import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--fg-on-primary)] hover:bg-[var(--primary-hover)]",
        ghost: "hover:bg-[var(--bg-hover)] text-[var(--fg-muted)] hover:text-[var(--fg)]",
        outline:
          "border border-[var(--border)] bg-transparent hover:bg-[var(--bg-hover)] text-[var(--fg)]",
        link: "text-[var(--fg)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 rounded-[var(--radius-default)]",
        sm: "h-8 px-3 text-xs rounded-[var(--radius-default)]",
        lg: "h-10 px-6 rounded-[var(--radius-default)]",
        icon: "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button: FC<ButtonProps> = ({ className, variant, size, asChild = false, ...props }) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
};

export type { ButtonProps };
export { Button, buttonVariants };
