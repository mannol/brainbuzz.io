import { useCallback } from 'react'
import { memoize } from 'lodash'

function useMemoizedCallback(callback: any, deps: React.DependencyList) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(memoize(callback), deps)
}

export default useMemoizedCallback
