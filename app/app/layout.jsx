import './globals.css'

export const metadata = {
  title: 'yuin · app',
  description: 'Set up who gets into your app, and prove it works.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/logo.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
