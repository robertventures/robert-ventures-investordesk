'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './SignInForm.module.css'

export default function SignInForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      // Call login API
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
        credentials: 'include' // Important for cookies
      })

      const data = await res.json()

      if (!data.success) {
        // Handle specific error messages
        if (res.status === 401) {
          setErrors({ password: 'Invalid email or password' })
        } else {
          alert('Error: ' + (data.error || 'Failed to sign in'))
        }
        setIsLoading(false)
        return
      }

      // Login successful - user data is in data.user
      const user = data.user

      // Store minimal user info in localStorage for backward compatibility
      localStorage.setItem('currentUserId', user.id)
      localStorage.setItem('signupEmail', user.email)

      // Redirect based on user type
      if (user.isAdmin) {
        router.push('/admin')
      } else if (!user.isVerified) {
        router.push('/confirmation')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Login error:', err)
      alert('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.signInForm}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
            placeholder="Enter your email address"
            disabled={isLoading}
          />
          {errors.email && <span className={styles.errorText}>{errors.email}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <div className={styles.inputWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={`${styles.input} ${styles.inputWithToggle} ${errors.password ? styles.inputError : ''}`}
              placeholder="Enter your password"
              disabled={isLoading}
            />
            <button
              type="button"
              className={styles.toggleButton}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(prev => !prev)}
              disabled={isLoading}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.password && <span className={styles.errorText}>{errors.password}</span>}
        </div>

        <div className={styles.actions}>
          <button 
            type="submit" 
            className={styles.signInButton}
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </div>
      </form>

      <div className={styles.footer}>
        <button 
          onClick={() => router.push('/forgot-password')} 
          className={styles.linkButton}
          style={{ marginBottom: '12px', display: 'block' }}
        >
          Forgot Password?
        </button>
        <p className={styles.footerText}>
          Don't have an account?{' '}
          <button 
            onClick={() => router.push('/')} 
            className={styles.linkButton}
          >
            Create Account
          </button>
        </p>
      </div>
    </div>
  )
}
