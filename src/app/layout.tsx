import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import RecoilRootProvider from '@/core/modules/nextjs-recoil/RecoilRootProvider'
import ViewportHeightSetter from '@/core/modules/viewport-setter/ViewportHeightSetter'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  manifest: "./manifest.json",
  title: "blindroute"
}

interface RootLayoutProps {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  // Render
  return (
    <html lang="en">
      <body className={inter.className}>
        <ViewportHeightSetter />
        <RecoilRootProvider>
          <div style={{
            height: "calc(var(--vh, 1vh) * 100)",
            width: "100vw"
          }}>
            {children}
          </div>
        </RecoilRootProvider>
      </body>
    </html >
  )
}