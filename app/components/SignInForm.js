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
      // Find user by email
      const res = await fetch('/api/users')
      const data = await res.json()
      
      if (!data.success) {
        alert('Error: Failed to connect to server')
        return
      }

      const users = data.users || []
      // Handle potential duplicate records by email. Prefer the most recently updated
      // user that also has a password set.
      const matches = users.filter(u => u.email && u.email.toLowerCase() === formData.email.toLowerCase())
      const sorted = matches.sort((a, b) => {
        const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return db - da
      })
      const user = sorted.find(u => typeof u.password === 'string' && u.password.length > 0) || sorted[0]

      if (!user) {
        setErrors({ email: 'No account found with this email address' })
        setIsLoading(false)
        return
      }

      if (user.password !== formData.password) {
        setErrors({ password: 'Incorrect password' })
        setIsLoading(false)
        return
      }

      // Store user session
      localStorage.setItem('currentUserId', user.id)
      localStorage.setItem('signupEmail', user.email)

      // Redirect admins to admin dashboard
      if (user.isAdmin) {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      console.error(err)
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
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
            placeholder="Enter your password"
            disabled={isLoading}
          />
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
