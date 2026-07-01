import type { ButtonHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "icon"
}

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "ui-button",
        `ui-button--${variant}`,
        size === "icon" && "ui-button--icon",
        className,
      )}
      {...props}
    />
  )
}
