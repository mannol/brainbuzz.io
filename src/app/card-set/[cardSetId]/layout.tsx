import { Metadata } from 'next'
import { Props } from './page'
import prisma from '@/lib/prisma'

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

export default async function CardSetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
