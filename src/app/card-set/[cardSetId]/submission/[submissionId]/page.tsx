import Details from './details'

type Props = {
  params: { cardSetId: string; submissionId: string }
}

export default async function Submission(props: Props) {
  return (
    <main className="flex flex-1 flex-col min-h-screen pb-10">
      <Details cardSetId={props.params.cardSetId} submissionId={props.params.submissionId} />
    </main>
  )
}
