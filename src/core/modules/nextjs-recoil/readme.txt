#1 - npm i recoil


#2 - ./app/layout.tsx에 RecoilRootProvider를 추가
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Render
  return (
    <html lang="en">
      <body className={inter.className}>
        <RecoilRootProvider>
          {children}
        </RecoilRootProvider>
      </body>
    </html>
  )
}
