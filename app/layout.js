import './globals.css'
import AuthWrapper from './components/AuthWrapper'

export const metadata = {
  title: 'Robert Ventures - Wealth Manager',
  description: 'Investment platform for Robert Ventures investors',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthWrapper>
          {children}
        </AuthWrapper>
      </body>
    </html>
  )
}
