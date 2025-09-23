'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AuthWrapper({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/sign-in']
  
  // Check if current route is public
  const isPublicRoute = publicRoutes.includes(pathname)

  useEffect(() => {
    const checkAuth = () => {
      const userId = localStorage.getItem('currentUserId')
      const isLoggedIn = !!userId
      
      setIsAuthenticated(isLoggedIn)
      setIsLoading(false)

      // If user is not logged in and trying to access protected route
      if (!isLoggedIn && !isPublicRoute) {
        router.push('/')
        return
      }

      // If user is logged in and on public routes, redirect to dashboard
      if (isLoggedIn && isPublicRoute && pathname !== '/') {
        router.push('/dashboard')
        return
      }
    }

    checkAuth()

    // Listen for storage changes (logout from another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'currentUserId' && !e.newValue) {
        setIsAuthenticated(false)
        if (!isPublicRoute) {
          router.push('/')
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [pathname, router, isPublicRoute])

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '16px',
        color: '#6b7280'
      }}>
        Loading...
      </div>
    )
  }

  // Don't render protected content if not authenticated and not on public route
  if (!isAuthenticated && !isPublicRoute) {
    return null
  }

  return children
}
