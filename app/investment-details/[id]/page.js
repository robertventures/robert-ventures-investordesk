import InvestmentDetailsHeader from '../../components/InvestmentDetailsHeader'
import InvestmentDetailsContent from '../../components/InvestmentDetailsContent'
import FixedInvestButton from '../../components/FixedInvestButton'
import styles from './page.module.css'

export default function InvestmentDetailsPage({ params }) {
  return (
    <div className={styles.main}>
      <InvestmentDetailsHeader investmentId={params.id} />
      <div className={styles.container}>
        <InvestmentDetailsContent investmentId={params.id} />
      </div>
      <FixedInvestButton />
    </div>
  )
}
