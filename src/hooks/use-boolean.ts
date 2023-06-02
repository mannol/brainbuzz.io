import { Dispatch, SetStateAction, useCallback, useMemo, useState } from 'react'

function useBoolean(defaultValue?: boolean): [
  boolean,
  {
    setValue: Dispatch<SetStateAction<boolean>>
    on: () => void
    off: () => void
    toggle: () => void
  },
] {
  const [value, setValue] = useState(!!defaultValue)

  const on = useCallback(() => setValue(true), [])
  const off = useCallback(() => setValue(false), [])
  const toggle = useCallback(() => setValue((x) => !x), [])

  const memoized = useMemo(() => ({ setValue, on, off, toggle }), [off, on, toggle])

  return [value, memoized]
}

export default useBoolean
