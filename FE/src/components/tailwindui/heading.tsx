
import clsx from 'clsx'

const styles = {
  1: 'text-2xl/8 font-semibold text-zinc-950 sm:text-xl/8 dark:text-white',
  2: 'text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white',
  3: 'text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white',
}

export function Heading({
  level = 1,
  className,
  ...props
}: { level?: keyof typeof styles } & Omit<React.ComponentPropsWithoutRef<'h1'>, 'className'> & {
  className?: string
}) {
  let Element: `h${keyof typeof styles}` = `h${level}`

  return <Element {...props} className={clsx(className, styles[level])} />
}
