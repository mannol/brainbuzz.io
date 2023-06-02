import getServerSession from '@/app/get-server-session'
import searchParam, { SearchParamProps } from '@/util/search-param'
import Questions from './questions'

export type Props = SearchParamProps & {
  params: { cardSetId: string; retake?: string }
}

export default async function CardSet(props: Props) {
  const user = await getServerSession()
  const retake = searchParam('retake', props)

  return (
    <main className="flex flex-1 flex-col min-h-screen pb-10">
      <Questions user={user} cardSetId={props.params.cardSetId} retake={retake} />
    </main>
  )
}
