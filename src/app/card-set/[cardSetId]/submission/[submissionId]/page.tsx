import prisma from '@/lib/prisma'
import { Metadata } from 'next'
import Details from './details'

type Props = {
  params: { cardSetId: string; submissionId: string }
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

export default async function Submission(props: Props) {
  return (
    <main className="flex flex-1 flex-col min-h-screen pb-10">
      <Details cardSetId={props.params.cardSetId} submissionId={props.params.submissionId} />
    </main>
  )
}
