import { forwardRef } from 'react'

const DATE_MIN = '1990-01-01'
const DATE_MAX = '2100-12-31'

/**
 * Drop-in replacement for <input type="date">.
 * Defaults min to 1990-01-01 and max to 2100-12-31.
 * Pass explicit min/max props to override (e.g. year-locked ranges in ComponentCostDialog).
 */
export const DateInput = forwardRef<
  HTMLInputElement,
  Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>
>(function DateInput({ min, max, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="date"
      min={min ?? DATE_MIN}
      max={max ?? DATE_MAX}
      {...props}
    />
  )
})
