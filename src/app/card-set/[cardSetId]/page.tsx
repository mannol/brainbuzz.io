import getServerSession from '@/app/get-server-session'
import searchParam, { SearchParamProps } from '@/util/search-param'
import prisma from '@/lib/prisma'
import { Metadata } from 'next'
import Questions from './questions'

export type Props = SearchParamProps & {
  params: { cardSetId: string; retake?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = params.cardSetId

  const cardSet = await prisma.cardSet.findUnique({ where: { id } })

  if (!cardSet) {
    return {
      title: '404 - Not Found',
    }
  }

  return {
    title: 'BrainBuzz - ' + cardSet.title,
  }
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
