import { Balancer } from 'react-wrap-balancer'
import Steps from './steps'
import Link from 'next/link'
import { RiArrowLeftLine } from 'react-icons/ri'
import getServerSession from '@/app/get-server-session'
import prisma from '@/lib/prisma'
import { Metadata } from 'next'

type Props = {
  params: { cardSetId: string }
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

export default async function CardSetStatus(props: Props) {
  const user = await getServerSession()

  return (
    <main className="flex flex-1 justify-center pb-16 pt-12 sm:pt-24 px-10 sm:px-24 md:px-10">
      <div className="flex flex-row w-full max-w-3xl">
        <div className="flex flex-col w-full mr-auto">
          <Link href="/" replace className="group text-base font-bold place-self-start">
            <RiArrowLeftLine className="inline-block mr-2 group-hover:mr-3 group-hover:-ml-1 w-4 h-4 -mt-1 transition-all" />
            <span>BACK</span>
          </Link>
          <h1 className="text-xl sm:text-3xl font-bold mt-3 mb-2">Studying your file:</h1>
          <Steps user={user} cardSetId={props.params.cardSetId} />
        </div>
        <div className="place-self-start hidden md:block rounded-2xl border bg-base-200 border-gray-600 mt-14 p-4 pb-5 max-w-xs h-auto w-full">
          <h6 className="font-bold text-lg mb-2">Did you know?</h6>
          <p className="text-sm">
            <Balancer>
              In 1951, Christopher Strachey, who later became the director of the Programming
              Research Group at the University of Oxford, authored the earliest AI program. This
              program, designed to play checkers (draughts), successfully ran on the Ferranti Mark I
              computer at the University of Manchester, England. By the summer of 1952, the program
              had advanced to the point where it could play a full game of checkers at a
              satisfactory speed.
            </Balancer>
          </p>
        </div>
      </div>
    </main>
  )
}
