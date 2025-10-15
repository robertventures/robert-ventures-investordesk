'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AuthWrapper({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/sign-in', '/forgot-password', '/reset-password']
  
  // Check if current route is public
  const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/reset-password')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Verify authentication via API
        const res = await fetch('/api/auth/me', {
          credentials: 'include' // Important for cookies
        })

        const isLoggedIn = res.ok

        if (isLoggedIn) {
          const data = await res.json()
          if (data.success && data.user) {
            // Store user ID in localStorage for backward compatibility
            localStorage.setItem('currentUserId', data.user.id)
            localStorage.setItem('signupEmail', data.user.email)
          }
        } else {
          // Clear localStorage if not authenticated
          localStorage.removeItem('currentUserId')
          localStorage.removeItem('signupEmail')
        }
        
        setIsAuthenticated(isLoggedIn)
        setIsLoading(false)

        // If user is not logged in and trying to access protected route
        if (!isLoggedIn && !isPublicRoute) {
          router.push('/sign-in')
          return
        }

        // If user is logged in and on sign-in route, redirect to dashboard
        if (isLoggedIn && pathname === '/sign-in') {
          router.push('/dashboard')
          return
        }
      } catch (error) {
        console.error('Auth check error:', error)
        setIsAuthenticated(false)
        setIsLoading(false)
        
        if (!isPublicRoute) {
          router.push('/sign-in')
        }
      }
    }

    checkAuth()

    // Listen for storage changes (logout from another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'currentUserId' && !e.newValue) {
        setIsAuthenticated(false)
        if (!isPublicRoute) {
          router.push('/sign-in')
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
