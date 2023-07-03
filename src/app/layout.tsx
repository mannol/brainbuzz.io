import './globals.css'
import clsx from 'clsx'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { TrpcProvider } from '@/requests/trpc-provider'
import { Metadata } from 'next'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BrainBuzz - AI Generated Quizzes & Tests',
  description:
    "We're here to assist you in generating custom quizzes. Simply upload the documents " +
    "that encompass the material you wish to test on, and we'll take it from there. " +
    "Whether it's a scientific paper, a book, a script, or anything else, we've got you covered.",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={clsx(inter.className, 'min-h-screen flex flex-col')}>
        <TrpcProvider>{children}</TrpcProvider>
        <footer className="footer footer-center p-4 bg-base-300 text-base-content mt-auto">
          <div>
            <p>Copyright © 2023 - All right reserved by Stigma Media, LLC</p>
          </div>
        </footer>
        <Analytics />

        {/* Google AdWords analytics */}
        <Script async id="aw" src="https://www.googletagmanager.com/gtag/js?id=AW-11032259157" />
        <Script async id="aw-tag">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
          
            gtag('config', 'AW-11032259157');
          `}
        </Script>
      </body>
    </html>
  )
}
