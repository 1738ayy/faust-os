import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:border-sky-400/50 focus-visible:ring-3 focus-visible:ring-sky-300/25 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red-500/50 aria-invalid:ring-3 aria-invalid:ring-red-500/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-sky-500 text-white shadow-lg shadow-sky-950/30 hover:bg-sky-400 hover:shadow-sky-950/40",
        outline:
          "border-sky-950/60 bg-zinc-950/50 text-zinc-100 shadow-sm shadow-black/10 hover:border-sky-400/50 hover:bg-sky-950/15 hover:text-white aria-expanded:border-sky-400/50 aria-expanded:bg-sky-950/20",
        secondary:
          "border border-sky-950/60 bg-zinc-950/50 text-zinc-100 hover:border-sky-400/50 hover:bg-sky-950/15 hover:text-white aria-expanded:border-sky-400/50 aria-expanded:bg-sky-950/20",
        ghost:
          "text-zinc-300 hover:bg-sky-950/15 hover:text-white aria-expanded:bg-sky-950/20 aria-expanded:text-white",
        destructive:
          "border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 focus-visible:border-red-500/50 focus-visible:ring-red-500/25",
        link: "text-sky-200 underline-offset-4 hover:text-sky-50 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-4 in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-3 in-data-[slot=button-group]:rounded-full has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        lg: "h-11 gap-1.5 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
