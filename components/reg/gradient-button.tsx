import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Variant = "blue" | "orange" | "white" | "ice";

type BaseProps = {
  children: React.ReactNode;
  className?: string;
  /** show the trailing arrow icon (default true) */
  withArrow?: boolean;
  /** visual style across the page */
  variant?: Variant;
};

type LinkProps = BaseProps & { href: string };
type ButtonProps = BaseProps & {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

const VARIANTS: Record<Variant, string> = {
  blue: "text-white bg-gradient-to-r from-brand-blue to-brand-indigo shadow-card",
  orange:
    "text-white bg-gradient-to-r from-[#FF8A3D] to-[#F97316] shadow-[0_10px_24px_rgba(249,115,22,0.35)]",
  white: "text-navy-900 bg-white shadow-card",
  /* Mobile hero CTA — light blue → white ice gradient, dark text */
  ice: "text-navy-900 bg-gradient-to-r from-[#C7E0FF] via-white to-[#E8EDFF] shadow-[0_8px_24px_rgba(59,130,246,0.25)]",
};

/** Gradient pill button. Renders as a Link when `href` is set, else a <button>. */
export default function GradientButton(props: LinkProps | ButtonProps) {
  const { children, className = "", withArrow = true, variant = "blue" } = props;

  const base =
    "inline-flex items-center justify-center gap-2.5 rounded-full font-heading font-semibold " +
    "transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-100 " +
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/30 " +
    "disabled:cursor-not-allowed disabled:opacity-70";

  const content = (
    <>
      <span>{children}</span>
      {withArrow &&
        (variant === "white" ? (
          // dark circular arrow badge (mobile hero CTA)
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-white">
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </span>
        ) : (
          <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
        ))}
    </>
  );

  const cls = `${base} ${VARIANTS[variant]} ${className}`;

  if (props.href !== undefined) {
    return (
      <Link href={props.href} className={cls}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cls}
    >
      {content}
    </button>
  );
}
