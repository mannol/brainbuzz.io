import { useCallback, DependencyList } from 'react'
import { memoize } from 'lodash'

function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList,
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(memoize(callback), deps)
}

export default useMemoizedCallback
