'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './AccountCreationForm.module.css'

export default function AccountCreationForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [accountExistsError, setAccountExistsError] = useState('')
  
  const hasUppercase = /[A-Z]/.test(form.password)
  const hasNumber = /[0-9]/.test(form.password)
  const hasSpecial = /[^A-Za-z0-9]/.test(form.password)
  const hasMinLength = form.password.length >= 8
  const isPasswordValid = hasUppercase && hasNumber && hasSpecial && hasMinLength

  const passwordRequirements = [
    { label: '8 Characters', isMet: hasMinLength },
    { label: '1 Uppercase letter', isMet: hasUppercase },
    { label: '1 Number', isMet: hasNumber },
    { label: '1 Special character', isMet: hasSpecial }
  ]

  const shouldShowRequirements = isPasswordFocused

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    if (accountExistsError) setAccountExistsError('')
  }

  const validate = () => {
    const newErrors = {}
    if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Invalid email'
    if (!isPasswordValid) newErrors.password = 'Password does not meet requirements'
    if (form.confirmPassword !== form.password) newErrors.confirmPassword = 'Passwords do not match'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSignInRedirect = () => {
    router.push('/sign-in')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setAccountExistsError('')
    
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password
        })
      })

      const data = await res.json()

      if (data.success && data.user) {
        localStorage.setItem('currentUserId', data.user.id)
        localStorage.setItem('signupEmail', form.email)
        router.push('/investment')
        return
      }

      if (res.status === 409 || data.error === 'User with this email already exists') {
        setAccountExistsError('An account with this email already exists. Please sign in instead.')
        return
      }

      alert(data.error || 'Failed to create account')
    } catch (err) {
      console.error('Signup error', err)
      alert('Unexpected error, please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {accountExistsError && (
        <div className={styles.accountExistsError}>
          <p className={styles.accountExistsText}>{accountExistsError}</p>
          <button 
            type="button"
            className={styles.signInRedirectButton}
            onClick={handleSignInRedirect}
          >
            Sign In Instead
          </button>
        </div>
      )}
      
      <div className={styles.grid}>
        <div className={styles.field}> 
          <label className={styles.label}>Email Address</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
            placeholder="Enter your email"
            autoComplete="email"
          />
          {errors.email && <span className={styles.error}>{errors.email}</span>}
        </div>

        

        <div className={styles.field}> 
          <label className={styles.label}>Password</label>
          <div className={styles.inputWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              className={`${styles.input} ${styles.inputWithToggle} ${errors.password ? styles.inputError : ''}`}
              placeholder="Create a password"
              autoComplete="new-password"
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
            />
            <button
              type="button"
              className={styles.toggleButton}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPassword(prev => !prev)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div
            className={`${styles.requirements} ${shouldShowRequirements ? styles.requirementsVisible : ''}`}
            aria-live="polite"
          >
            {passwordRequirements.map((requirement, index) => (
              <span
                key={requirement.label}
                className={`${styles.requirementItem} ${requirement.isMet ? styles.valid : styles.invalid}`}
              >
                {requirement.label}
                {index < passwordRequirements.length - 1 && (
                  <span aria-hidden="true" className={styles.requirementSeparator}>·</span>
                )}
              </span>
            ))}
          </div>
          {errors.password && <span className={styles.error}>{errors.password}</span>}
        </div>

        <div className={styles.field}> 
          <label className={styles.label}>Confirm Password</label>
          <div className={styles.inputWrapper}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              className={`${styles.input} ${styles.inputWithToggle} ${errors.confirmPassword ? styles.inputError : ''}`}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
            <button
              type="button"
              className={styles.toggleButton}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(prev => !prev)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.confirmPassword && <span className={styles.error}>{errors.confirmPassword}</span>}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          type="submit"
          disabled={submitting}
          onMouseDown={(e) => e.preventDefault()}
        >
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </div>

      <div className={styles.footer}>
        <p className={styles.footerText}>
          Already have an account?{' '}
          <button 
            type="button"
            onClick={handleSignInRedirect}
            className={styles.linkButton}
          >
            Sign In
          </button>
        </p>
      </div>
    </form>
  )
}


