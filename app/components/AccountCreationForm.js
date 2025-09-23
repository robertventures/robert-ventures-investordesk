'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './AccountCreationForm.module.css'

export default function AccountCreationForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const hasUppercase = /[A-Z]/.test(form.password)
  const hasNumber = /[0-9]/.test(form.password)
  const hasSpecial = /[^A-Za-z0-9]/.test(form.password)
  const hasMinLength = form.password.length >= 8
  const isPasswordValid = hasUppercase && hasNumber && hasSpecial && hasMinLength

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const newErrors = {}
    if (!form.firstName.trim()) newErrors.firstName = 'Required'
    if (!form.lastName.trim()) newErrors.lastName = 'Required'
    if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Invalid email'
    if (!isPasswordValid) newErrors.password = 'Password does not meet requirements'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
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
        const existingRes = await fetch(`/api/users?email=${encodeURIComponent(form.email)}`)
        const existingData = await existingRes.json()
        if (existingData.success && existingData.user) {
          localStorage.setItem('currentUserId', existingData.user.id)
          localStorage.setItem('signupEmail', form.email)
          router.push('/investment')
          return
        }
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
      <div className={styles.grid}>
        <div className={styles.field}> 
          <label className={styles.label}>First Name</label>
          <input
            type="text"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`}
            placeholder="Enter your first name"
            autoComplete="given-name"
          />
          {errors.firstName && <span className={styles.error}>{errors.firstName}</span>}
        </div>

        <div className={styles.field}> 
          <label className={styles.label}>Last Name</label>
          <input
            type="text"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`}
            placeholder="Enter your last name"
            autoComplete="family-name"
          />
          {errors.lastName && <span className={styles.error}>{errors.lastName}</span>}
        </div>

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
            />
            <button
              type="button"
              className={styles.toggleButton}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(prev => !prev)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className={styles.requirements} aria-live="polite">
            <div className={`${styles.requirementItem} ${hasMinLength ? styles.valid : styles.invalid}`}>At least 8 characters</div>
            <div className={`${styles.requirementItem} ${hasUppercase ? styles.valid : styles.invalid}`}>At least one uppercase letter</div>
            <div className={`${styles.requirementItem} ${hasNumber ? styles.valid : styles.invalid}`}>At least one number</div>
            <div className={`${styles.requirementItem} ${hasSpecial ? styles.valid : styles.invalid}`}>At least one special character</div>
          </div>
          {errors.password && <span className={styles.error}>{errors.password}</span>}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.primaryButton} type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </div>
    </form>
  )
}


