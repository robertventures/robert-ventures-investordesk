"use client"
import Header from '../components/Header'
import styles from './page.module.css'
import { useEffect, useState } from 'react'

export default function FinalizeInvestmentPage() {
  return (
    <main className={styles.main}>
      <Header />
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Finalize Your Investment</h1>
          <p className={styles.subtitle}>Confirm eligibility, complete documents, and choose a payment method to proceed.</p>
          <ClientContent />
        </div>
      </div>
    </main>
  )
}

function ClientContent() {
  const [user, setUser] = useState(null)
  const [investment, setInvestment] = useState(null)
  const [accredited, setAccredited] = useState('')
  const [accreditedType, setAccreditedType] = useState('')
  const [tenPercentConfirmed, setTenPercentConfirmed] = useState(false)
  const [fundingMethod, setFundingMethod] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('bank-account')
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState([])
  const [availableBanks, setAvailableBanks] = useState([])
  const [selectedBankId, setSelectedBankId] = useState('')

  useEffect(() => {
    const load = async () => {
      const userId = localStorage.getItem('currentUserId')
      const investmentId = localStorage.getItem('currentInvestmentId')
      if (!userId) return
      const res = await fetch(`/api/users/${userId}`)
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        const inv = (data.user.investments || []).find(i => i.id === investmentId) || null
        setInvestment(inv)
        const banks = Array.isArray(data.user.bankAccounts) ? data.user.bankAccounts : []
        setAvailableBanks(banks)
        // Preselect last used bank if present
        if (banks.length > 0) {
          const lastUsed = banks.reduce((latest, b) => {
            const t = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0
            return t > (latest.t || 0) ? { id: b.id, t } : latest
          }, { id: '', t: 0 })
          if (lastUsed.id) setSelectedBankId(lastUsed.id)
        }
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (investment?.compliance) {
      setAccredited(investment.compliance.accredited || '')
      setAccreditedType(investment.compliance.accreditedType || '')
      setTenPercentConfirmed(Boolean(investment.compliance.tenPercentLimitConfirmed))
    }
  }, [investment?.compliance])

  // Load banking details from user account
  useEffect(() => {
    if (user?.banking) {
      setFundingMethod(user.banking.fundingMethod || '')
      setPayoutMethod(user.banking.payoutMethod || 'bank-account')
      if (user.banking.defaultBankAccountId) setSelectedBankId(user.banking.defaultBankAccountId)
    }
  }, [user?.banking])

  // Enforce payout method when monthly payments are selected
  useEffect(() => {
    if (investment?.paymentFrequency === 'monthly' && payoutMethod !== 'bank-account') {
      setPayoutMethod('bank-account')
    }
  }, [investment?.paymentFrequency, payoutMethod])

  // Force wire transfer for IRA accounts (must be declared before any conditional return)
  useEffect(() => {
    if (investment?.accountType === 'ira' && fundingMethod !== 'wire-transfer') {
      setFundingMethod('wire-transfer')
    }
  }, [investment?.accountType, fundingMethod])

  // Clear validation errors when relevant inputs change
  useEffect(() => {
    if (validationErrors.length) {
      setValidationErrors([])
    }
  }, [accredited, accreditedType, tenPercentConfirmed, fundingMethod, payoutMethod, selectedBankId])

  if (!user) return <div className={styles.loading}>Loading...</div>

  const isIra = investment?.accountType === 'ira'

  return (
    <div className={styles.sections}>
      <Section title="Investor Confirmation">
        <div className={styles.radioGroup}>
          <div className={styles.radioOption}>
            <label>
              <input
                type="radio"
                name="accredited"
                value="accredited"
                checked={accredited === 'accredited'}
                onChange={() => {
                  setAccredited('accredited')
                  setAccreditedType('')
                  setTenPercentConfirmed(false)
                }}
              />
              <span>Investor meets the definition of "accredited investor"</span>
            </label>
            
            {accredited === 'accredited' && (
              <div className={styles.subOptions}>
                <label className={styles.subOption}>
                  <input
                    type="radio"
                    name="accreditedType"
                    value="assets"
                    checked={accreditedType === 'assets'}
                    onChange={() => setAccreditedType('assets')}
                  />
                  <span>Net worth over $1 million (excluding primary residence)</span>
                </label>
                <label className={styles.subOption}>
                  <input
                    type="radio"
                    name="accreditedType"
                    value="income"
                    checked={accreditedType === 'income'}
                    onChange={() => setAccreditedType('income')}
                  />
                  <span>Annual income over $200,000 (individual) or $300,000 (joint)</span>
                </label>
              </div>
            )}
          </div>
          
          <div className={styles.radioOption}>
            <label>
              <input
                type="radio"
                name="accredited"
                value="not_accredited"
                checked={accredited === 'not_accredited'}
                onChange={() => {
                  setAccredited('not_accredited')
                  setAccreditedType('')
                }}
              />
              <span>Investor does not meet the definition of "accredited investor" or is not sure</span>
            </label>
            {accredited === 'not_accredited' && (
              <div className={styles.subOptions}>
                <label className={styles.subOption}>
                  <input
                    type="checkbox"
                    checked={tenPercentConfirmed}
                    onChange={(e) => setTenPercentConfirmed(e.target.checked)}
                  />
                  <span>the investor confirms their investment is not more than 10% of their net worth or annual income.</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Document Signup" raw>
        <div className={styles.rows}>
          <div className={styles.row}>
            <div className={styles.rowLabel}>Documents</div>
            <div className={styles.rowValue}>Coming soon</div>
          </div>
        </div>
      </Section>

      <Section title="Payment" raw>
        {/* Funding method */}
        <div className={styles.subSection}>
          <div className={styles.groupTitle}>Funding</div>
          <div className={styles.radioGroup}>
            {!isIra && (
              <div className={styles.radioOption}>
                <label>
                  <input
                    type="radio"
                    name="funding"
                    value="bank-transfer"
                    checked={fundingMethod === 'bank-transfer'}
                    onChange={() => setFundingMethod('bank-transfer')}
                  />
                  <span>Bank Transfer</span>
                </label>
                {fundingMethod === 'bank-transfer' && (
                  <div>
                    {availableBanks.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontWeight: 600, marginRight: 8 }}>Select Bank:</label>
                        <select
                          className={styles.secondaryButton}
                          value={selectedBankId || ''}
                          onChange={(e) => setSelectedBankId(e.target.value)}
                        >
                          {availableBanks.map(b => (
                            <option key={b.id} value={b.id}>{b.nickname || 'Bank Account'}</option>
                          ))}
                          <option value="">Use Default Bank</option>
                        </select>
                      </div>
                    ) : (
                      <div className={styles.bankBox} style={{ marginTop: 8 }}>Default Bank will be used</div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className={styles.radioOption}>
              <label>
                <input
                  type="radio"
                  name="funding"
                  value="wire-transfer"
                  checked={fundingMethod === 'wire-transfer'}
                  onChange={() => setFundingMethod('wire-transfer')}
                />
                <span>Wire Transfer</span>
              </label>
              {fundingMethod === 'wire-transfer' && (
                <div>
                  <div className={styles.wireRow}><b>Beneficiary:</b> Robert Ventures</div>
                  <div className={styles.wireRow}><b>Bank:</b> Example Bank</div>
                  <div className={styles.wireRow}><b>Routing #:</b> 123456789</div>
                  <div className={styles.wireRow}><b>Account #:</b> 987654321</div>
                  <div className={styles.wireRow}><b>Reference:</b> {user.firstName} {user.lastName}</div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    style={{ marginTop: '12px' }}
                    onClick={() => {
                      const content = `Wire Transfer Instructions\n\n` +
                        `Beneficiary: Robert Ventures\n` +
                        `Bank: Example Bank\n` +
                        `Routing #: 123456789\n` +
                        `Account #: 987654321\n` +
                        `Reference: ${user.firstName} ${user.lastName}`
                      const html = `<!doctype html><html><head><meta charset=\"utf-8\"><title>Wire Transfer Instructions</title>` +
                        `<style>body{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;color:#111}.h{font-size:20px;font-weight:700;margin:0 0 12px}p{margin:6px 0}</style>` +
                        `</head><body><div class=\"h\">Wire Transfer Instructions</div>` +
                        `<p><b>Beneficiary:</b> Robert Ventures</p>` +
                        `<p><b>Bank:</b> Example Bank</p>` +
                        `<p><b>Routing #:</b> 123456789</p>` +
                        `<p><b>Account #:</b> 987654321</p>` +
                        `<p><b>Reference:</b> ${user.firstName} ${user.lastName}</p>` +
                        `</body></html>`
                      const w = window.open('', '_blank', 'noopener,noreferrer')
                      if (w) {
                        w.document.open()
                        w.document.write(html)
                        w.document.close()
                        w.focus()
                        w.print()
                      } else {
                        // Fallback to text download
                        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'wire-instructions.txt'
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      }
                    }}
                  >
                    Download PDF Instructions
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payout method (only for monthly payments) */}
        {investment?.paymentFrequency === 'monthly' && (
          <div className={styles.subSection}>
            <div className={styles.groupTitle}>Payout</div>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="payout"
                  value="bank-account"
                  checked={payoutMethod === 'bank-account'}
                  onChange={() => setPayoutMethod('bank-account')}
                />
                <span>Bank Account</span>
              </label>
            </div>
            {payoutMethod === 'bank-account' && (
              <div className={styles.bankBox}>
                <button type="button" className={styles.secondaryButton}>Connect Payout Bank Account</button>
              </div>
            )}
          </div>
        )}
      </Section>

      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          disabled={isSaving}
          onClick={async () => {
            if (!investment) return
            // Validate required fields before continuing
            const errors = []
            if (!accredited) {
              errors.push('Select whether you are an accredited investor.')
            }
            if (accredited === 'accredited' && !accreditedType) {
              errors.push('Select an accredited investor type.')
            }
            if (accredited === 'not_accredited' && !tenPercentConfirmed) {
              errors.push('Confirm the 10% investment limit acknowledgement.')
            }
            if (!fundingMethod) {
              errors.push('Choose a funding method.')
            }
            if (investment?.paymentFrequency === 'monthly' && payoutMethod !== 'bank-account') {
              errors.push('Select a payout method for monthly earnings.')
            }
            if (errors.length) {
              setValidationErrors(errors)
              return
            }
            setIsSaving(true)
            try {
              const userId = user.id
              const investmentId = investment.id
              const earningsMethod = investment.paymentFrequency === 'monthly' ? payoutMethod : 'compounding'

              // Determine bank account to use when bank-transfer is selected
              let bankToUse = null
              if (fundingMethod === 'bank-transfer') {
                const nowIso = new Date().toISOString()
                const existing = availableBanks.find(b => b.id === selectedBankId)
                if (existing) {
                  bankToUse = { ...existing, lastUsedAt: nowIso }
                } else {
                  bankToUse = {
                    id: `bank-${Date.now()}`,
                    nickname: 'Default Bank',
                    type: 'ach',
                    createdAt: nowIso,
                    lastUsedAt: nowIso
                  }
                }
              }
              
              // Update the draft investment to pending status with compliance and banking data
              await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  _action: 'updateInvestment',
                  investmentId,
                  fields: {
                    compliance: {
                      accredited,
                      accreditedType: accredited === 'accredited' ? accreditedType : null,
                      tenPercentLimitConfirmed: accredited === 'not_accredited' ? tenPercentConfirmed : null
                    },
                    banking: {
                      fundingMethod,
                      earningsMethod,
                      bank: bankToUse ? { id: bankToUse.id, nickname: bankToUse.nickname, type: bankToUse.type } : null
                    },
                    status: 'pending',
                    submittedAt: new Date().toISOString()
                  }
                })
              })
              
              // Store banking details and bank accounts on user account
              const nextBankAccounts = (() => {
                if (!bankToUse) return availableBanks
                const others = availableBanks.filter(b => b.id !== bankToUse.id)
                return [bankToUse, ...others]
              })()

              await fetch(`/api/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  banking: { 
                    fundingMethod, 
                    earningsMethod, 
                    payoutMethod,
                    ...(bankToUse ? { defaultBankAccountId: bankToUse.id } : {})
                  },
                  ...(bankToUse ? { bankAccounts: nextBankAccounts } : {})
                })
              })
              
              window.location.href = '/dashboard'
            } catch (e) {
              console.error('Failed to save finalization data', e)
            } finally {
              setIsSaving(false)
            }
          }}
        >
          {isSaving ? 'Saving...' : 'Continue'}
        </button>
        {validationErrors.length > 0 && (
          <div className={styles.warning}>
            <div className={styles.warningTitle}>Please complete the following before continuing:</div>
            <ul className={styles.warningList}>
              {validationErrors.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children, raw = false }) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {raw ? (
        children
      ) : (
        <div className={styles.rows}>{children}</div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{label}</div>
      <div className={styles.rowValue}>{value || '-'}</div>
    </div>
  )
}


