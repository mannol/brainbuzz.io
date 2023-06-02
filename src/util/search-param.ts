import { isArray } from 'lodash'

export type SearchParamProps = {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function searchParam<P extends SearchParamProps>(name: string, props: P) {
  const param = props.searchParams[name]

  return isArray(param) ? param[0] : param
}
