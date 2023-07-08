import getServerSession from './get-server-session'
import Header from './header'
import UploadZone from './upload-zone'
import { createServerSideHelpers } from '@trpc/react-query/server'
import { appRouter } from '@/server/routers/app'
import AllCards from './all-cards'

const faq = [
  {
    title: 'How does BrainBuzz work?',
    content: (
      <ol className="list-decimal pl-4 space-y-2">
        <li>
          <span className="font-bold">Upload your materials:</span> Begin by uploading the documents
          that contain the content you want to create quizzes on. These can be scientific papers,
          books, scripts, or any other relevant material.
        </li>
        <li>
          <span className="font-bold">Automated analysis:</span> Our advanced system will carefully
          analyze the uploaded documents, extracting key information and identifying important
          concepts.
        </li>
        <li>
          <span className="font-bold">Quiz generation:</span> Using ChatGPT, BrainBuzz will
          automatically generate personalized quizzes tailored to your uploaded material. These
          quizzes will test your knowledge and understanding of the subject matter.
        </li>
        <li>
          <span className="font-bold">Quiz generation:</span> Using ChatGPT, BrainBuzz will
          automatically generate personalized quizzes tailored to your uploaded material. These
          quizzes will test your knowledge and understanding of the subject matter.
        </li>
        <li>
          <span className="font-bold">Take the quiz:</span> Once the quiz is generated, it&apos;s
          time to put your knowledge to the test! Take the quiz and see how well you grasp the
          material.
        </li>
        <li>
          <span className="font-bold">Instant feedback:</span> BrainBuzz provides immediate feedback
          on your quiz performance, highlighting correct and incorrect answers.
        </li>
      </ol>
    ),
  },
  {
    title: 'How are quiz questions and answers generated?',
    content: (
      <>
        <p className="mb-2">
          At BrainBuzz, we leverage cutting-edge ChatGPT technologies to generate quiz questions and
          answers for you. Our advanced system utilizes state-of-the-art natural language processing
          algorithms to analyze the uploaded materials and extract relevant information.
        </p>
        <p className="my-2">
          We generate questions that test your comprehension of the material by employing machine
          learning and language models. The system intelligently identifies key concepts, essential
          details, and critical information from the uploaded documents to formulate diverse and
          engaging quiz questions.
        </p>
        <p className="my-2">
          We aim to ensure the questions generated are accurate, comprehensive, and aligned with
          your content. We continuously refine and improve our algorithms to enhance the quality and
          relevance of the generated questions and answers.
        </p>
        <p className="mt-2">
          Rest assured, our intelligent quiz generation process leverages the latest advancements in
          natural language processing to deliver a seamless and practical learning experience for
          you.
        </p>
      </>
    ),
  },
  // {
  //   title: 'Why do we charge for this?',
  //   content: (
  //     <>
  //       <p className="mb-2">
  //         You may wonder why a charge is associated with our services. The reason behind this is
  //         that training and utilizing ChatGPT and AI technologies, in general, involve significant
  //         expenses. By charging for our software, we can ensure that we can maintain and improve the
  //         quality of our services while preventing potential abuse.
  //       </p>
  //       <p className="my-2">
  //         However, we have some good news for you. We offer a hassle-free refund policy. If you are
  //         unsatisfied with your purchase, you can request an automated refund within 24 hours of
  //         purchasing tokens. We provide a full refund, excluding any processing fees imposed by
  //         Stripe. Rest assured, no questions will be asked, and we aim to make the refund process as
  //         smooth as possible.
  //       </p>
  //       <p className="mt-2">
  //         Your support by purchasing our tokens enables us to continue developing and enhancing our
  //         software, making it even more valuable for our users like you. We greatly appreciate your
  //         understanding and look forward to providing you with an exceptional learning experience.
  //       </p>
  //     </>
  //   ),
  // },
  {
    title: 'I need some help! What can I do?',
    content: (
      <p>
        We&apos;re here to assist you whenever you need help! If you have any questions or require
        assistance, simply send us an email at{' '}
        <a className="link" href="mailto:support@stigma.dev">
          support@stigma.dev
        </a>
        . Our dedicated support team will promptly respond to your inquiry and provide the
        assistance you need.
      </p>
    ),
  },
]

export default async function Home() {
  const user = await getServerSession()

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: {
      user,
      requestUrl: new URL('http://localhost'),
    },
  })

  const allCards = await helpers.cardSet.findAll.fetch()
  const tokens = await helpers.billing.availableTokenCount.fetch()

  return (
    <>
      <Header tokens={tokens} loggedInUserEmail={user?.email} />
      <main className="flex flex-1 justify-center pb-6 pt-10 px-6">
        <div className="flex flex-col w-full max-w-2xl">
          <h1 className="text-2xl font-bold mb-2">Welcome to BrainBuzz!</h1>
          <p className="text-base mb-2">
            We&apos;re here to assist you in generating custom quizzes. Simply upload the documents
            that encompass the material you wish to test on, and we&apos;ll take it from there.
            Whether it&apos;s a scientific paper, a book, a script, or anything else, we&apos;ve got
            you covered.
          </p>
          <p className="text-base font-bold">Let&apos;s dive in and get started!</p>
          <div className="divider"></div>
          <UploadZone className="min-h-48 w-full" />
          {allCards.length ? (
            <>
              <h2 className="text-2xl font-bold mb-5 mt-16">Past quizzes:</h2>
              <AllCards allCards={allCards} />
            </>
          ) : null}
          <h2 className="text-2xl font-bold mb-4 mt-16">FAQ</h2>
          <div className="flex flex-col space-y-2">
            {faq.map((item, index) => (
              <div key={index} className="collapse collapse-arrow bg-base-200">
                <input type="radio" name="my-accordion-1" />
                <div className="collapse-title text-lg font-medium">{item.title}</div>
                <div className="collapse-content text-sm">{item.content}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
