"""
Investment Calculation Service
Port of lib/investmentCalculations.js to Python
MUST produce penny-perfect matching results
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dateutil.relativedelta import relativedelta


# Constants
MS_PER_DAY = 24 * 60 * 60 * 1000
RATES = {
    '1-year': 0.08,
    '3-year': 0.10
}


# ============================================================================
# Date Utility Functions
# ============================================================================

def to_utc_start_of_day(value: str) -> datetime:
    """Convert ISO string to UTC start of day"""
    date = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return datetime(date.year, date.month, date.day, 0, 0, 0)


def add_days_utc(date: datetime, days: int) -> datetime:
    """Add days to date"""
    return date + timedelta(days=days)


def get_days_in_month_utc(date: datetime) -> int:
    """Get number of days in month"""
    # Get first day of next month, then subtract to get last day of current month
    if date.month == 12:
        next_month = datetime(date.year + 1, 1, 1)
    else:
        next_month = datetime(date.year, date.month + 1, 1)
    last_day = next_month - timedelta(days=1)
    return last_day.day


def diff_days_inclusive(start_date: datetime, end_date: datetime) -> int:
    """Calculate days between dates (inclusive)"""
    return (end_date - start_date).days + 1


# ============================================================================
# Accrual Segmentation
# ============================================================================

def build_accrual_segments(start_date: datetime, end_date: datetime) -> List[Dict]:
    """
    Build accrual segments - break period into full months and partial months
    This exactly replicates the JavaScript buildAccrualSegments function
    """
    if end_date < start_date:
        return []
    
    segments = []
    cursor = start_date
    
    def push_partial(segment_start: datetime, segment_end: datetime, days_in_month: int):
        """Helper to add partial segment"""
        days = diff_days_inclusive(segment_start, segment_end)
        segments.append({
            'type': 'partial',
            'start': segment_start,
            'end': segment_end,
            'days': days,
            'days_in_month': days_in_month
        })
    
    # First partial month (if not starting on 1st)
    if cursor.day != 1:
        days_in_month = get_days_in_month_utc(cursor)
        month_end = to_utc_start_of_day(
            datetime(cursor.year, cursor.month, days_in_month).isoformat()
        )
        segment_end = month_end if month_end < end_date else end_date
        push_partial(cursor, segment_end, days_in_month)
        cursor = add_days_utc(segment_end, 1)
    
    # Full months
    while cursor <= end_date:
        days_in_month = get_days_in_month_utc(cursor)
        month_end = to_utc_start_of_day(
            datetime(cursor.year, cursor.month, days_in_month).isoformat()
        )
        
        if month_end <= end_date:
            # Full month
            segments.append({
                'type': 'full',
                'start': cursor,
                'end': month_end,
                'days': days_in_month,
                'days_in_month': days_in_month
            })
            cursor = add_days_utc(month_end, 1)
        else:
            # Partial month at end
            push_partial(cursor, end_date, days_in_month)
            break
    
    return segments


def calculate_months_elapsed(segments: List[Dict]) -> float:
    """Calculate months elapsed from segments"""
    months = 0.0
    for segment in segments:
        if segment['type'] == 'full':
            months += 1.0
        else:
            months += segment['days'] / segment['days_in_month']
    return months


# ============================================================================
# Main Calculation Function
# ============================================================================

def calculate_investment_value(
    investment: Dict,
    as_of_date: Optional[str] = None,
    include_partial_month: bool = False
) -> Dict:
    """
    Calculate current value of an investment with compound interest or monthly payouts
    
    This is a direct port of the JavaScript calculateInvestmentValue function
    MUST produce penny-perfect matching results
    
    Args:
        investment: Investment dict with amount, paymentFrequency, lockupPeriod, confirmedAt, status
        as_of_date: Calculate as of this date (ISO string), defaults to current time
        include_partial_month: Include partial current month (for withdrawals)
    
    Returns:
        Dict with currentValue, totalEarnings, monthsElapsed, isWithdrawable, lockupEndDate
    """
    if not investment:
        return {
            'current_value': 0,
            'total_earnings': 0,
            'months_elapsed': 0,
            'is_withdrawable': False,
            'lockup_end_date': None,
            'monthly_interest_amount': 0
        }
    
    # Only calculate compounding for confirmed investments
    if investment.get('status') not in ['active', 'withdrawal_notice', 'withdrawn']:
        return {
            'current_value': investment.get('amount', 0),
            'total_earnings': 0,
            'months_elapsed': 0,
            'is_withdrawable': False,
            'lockup_end_date': None,
            'monthly_interest_amount': 0
        }
    
    # Get confirmation date
    confirmation_timestamp = investment.get('confirmedAt') or investment.get('confirmed_at')
    if not confirmation_timestamp:
        return {
            'current_value': investment.get('amount', 0),
            'total_earnings': 0,
            'months_elapsed': 0,
            'is_withdrawable': False,
            'lockup_end_date': None,
            'monthly_interest_amount': 0
        }
    
    confirmed_date = to_utc_start_of_day(confirmation_timestamp)
    
    # Interest starts accruing from the day AFTER confirmation
    accrual_start_date = add_days_utc(confirmed_date, 1)
    
    # Get current date (or as_of_date)
    if as_of_date:
        current_date = to_utc_start_of_day(as_of_date)
    else:
        current_date = to_utc_start_of_day(datetime.utcnow().isoformat())
    
    # Calculate lockup end date
    lockup_end_date_value = investment.get('lockupEndDate') or investment.get('lockup_end_date')
    if lockup_end_date_value:
        lockup_end_date = to_utc_start_of_day(lockup_end_date_value)
    else:
        lockup_period = investment.get('lockupPeriod') or investment.get('lockup_period')
        lockup_years = 3 if lockup_period == '3-year' else 1
        lockup_end_date = confirmed_date + relativedelta(years=lockup_years)
    
    # If before accrual starts, no interest yet
    if current_date < accrual_start_date:
        lockup_period = investment.get('lockupPeriod') or investment.get('lockup_period')
        payment_frequency = investment.get('paymentFrequency') or investment.get('payment_frequency')
        amount = investment.get('amount', 0)
        
        apy = RATES.get(lockup_period, 0.08)
        monthly_interest = round(amount * (apy / 12) * 100) / 100 if payment_frequency == 'monthly' else 0
        
        return {
            'current_value': amount,
            'total_earnings': 0,
            'months_elapsed': 0,
            'is_withdrawable': False,
            'lockup_end_date': lockup_end_date.isoformat() + 'Z',
            'monthly_interest_amount': monthly_interest
        }
    
    # Get APY and rates
    lockup_period = investment.get('lockupPeriod') or investment.get('lockup_period')
    apy = RATES.get(lockup_period, 0.08)
    monthly_rate = apy / 12
    
    # Determine calculation end date
    if include_partial_month:
        calculation_end_date = current_date
    else:
        # Find last completed month end
        calculation_end_date = find_last_completed_month_end(accrual_start_date, current_date)
    
    # Build accrual segments
    segments = build_accrual_segments(accrual_start_date, calculation_end_date)
    
    # Calculate months elapsed
    months_elapsed = calculate_months_elapsed(segments)
    
    # Calculate interest based on payment frequency
    payment_frequency = investment.get('paymentFrequency') or investment.get('payment_frequency')
    amount = investment.get('amount', 0)
    
    if payment_frequency == 'compounding':
        current_value, total_earnings = calculate_compounding(amount, segments, monthly_rate, apy)
    else:  # monthly
        current_value, total_earnings = calculate_monthly_payout(amount, segments, monthly_rate, apy)
    
    # Calculate monthly interest amount for display
    monthly_interest_amount = 0
    if payment_frequency == 'monthly':
        monthly_interest_amount = round(amount * monthly_rate * 100) / 100
    
    # Check if withdrawable
    lockup_comparison_date = current_date if not as_of_date else to_utc_start_of_day(as_of_date)
    is_withdrawable = lockup_comparison_date >= lockup_end_date
    
    return {
        'current_value': round(current_value * 100) / 100,
        'total_earnings': round(total_earnings * 100) / 100,
        'months_elapsed': months_elapsed,
        'is_withdrawable': is_withdrawable,
        'lockup_end_date': lockup_end_date.isoformat() + 'Z',
        'monthly_interest_amount': monthly_interest_amount
    }


def find_last_completed_month_end(start_date: datetime, current_date: datetime) -> datetime:
    """Find the last completed month end before current date"""
    cursor = start_date
    last_month_end = None
    
    while cursor <= current_date:
        days_in_month = get_days_in_month_utc(cursor)
        month_end = datetime(cursor.year, cursor.month, days_in_month)
        
        if month_end < current_date:
            last_month_end = month_end
            cursor = add_days_utc(month_end, 1)
        else:
            break
    
    # If no completed months, return start date minus 1 day (will result in empty segments)
    return last_month_end if last_month_end else add_days_utc(start_date, -1)


# ============================================================================
# Compounding and Monthly Payout Calculations
# ============================================================================

def calculate_compounding(
    principal: float,
    segments: List[Dict],
    monthly_rate: float,
    apy: float
) -> Tuple[float, float]:
    """
    Calculate compounding interest
    Interest is added to principal each period
    MUST round after each step for penny-perfect accuracy
    """
    balance = principal
    total_earnings = 0.0
    daily_rate = apy / 365
    
    for segment in segments:
        if segment['type'] == 'full':
            # Full month: use monthly rate
            interest = round(balance * monthly_rate * 100) / 100
            balance = round((balance + interest) * 100) / 100
            total_earnings = round((total_earnings + interest) * 100) / 100
        else:
            # Partial month: use daily rate
            interest = round(balance * daily_rate * segment['days'] * 100) / 100
            balance = round((balance + interest) * 100) / 100
            total_earnings = round((total_earnings + interest) * 100) / 100
    
    return balance, total_earnings


def calculate_monthly_payout(
    principal: float,
    segments: List[Dict],
    monthly_rate: float,
    apy: float
) -> Tuple[float, float]:
    """
    Calculate monthly payout
    Interest is paid out each period, principal stays constant
    MUST round after each step for penny-perfect accuracy
    """
    total_earnings = 0.0
    monthly_interest = round(principal * monthly_rate * 100) / 100
    daily_rate = apy / 365
    
    for segment in segments:
        if segment['type'] == 'full':
            # Full month: full monthly interest
            total_earnings = round((total_earnings + monthly_interest) * 100) / 100
        else:
            # Partial month: prorate using daily rate
            prorated = round(principal * daily_rate * segment['days'] * 100) / 100
            total_earnings = round((total_earnings + prorated) * 100) / 100
    
    # Current value = original principal (interest paid out)
    return principal, total_earnings


# ============================================================================
# Additional Calculation Functions
# ============================================================================

def calculate_withdrawal_amount(investment: Dict, current_value: Dict) -> Dict:
    """Calculate withdrawal amounts for an investment"""
    if not current_value.get('is_withdrawable'):
        return {
            'can_withdraw': False,
            'withdrawable_amount': 0,
            'principal_amount': investment.get('amount', 0),
            'earnings_amount': 0,
            'lockup_end_date': current_value.get('lockup_end_date')
        }
    
    return {
        'can_withdraw': True,
        'withdrawable_amount': current_value.get('current_value', 0),
        'principal_amount': investment.get('amount', 0),
        'earnings_amount': current_value.get('total_earnings', 0),
        'lockup_end_date': current_value.get('lockup_end_date')
    }


def calculate_final_withdrawal_payout(investment: Dict, withdrawal_date: str) -> Dict:
    """
    Calculate final withdrawal payout including partial month interest
    Used when admin processes a withdrawal
    """
    if not investment or not investment.get('confirmedAt'):
        return {
            'final_value': investment.get('amount', 0) if investment else 0,
            'total_earnings': 0,
            'principal_amount': investment.get('amount', 0) if investment else 0,
            'withdrawal_date': withdrawal_date or datetime.utcnow().isoformat() + 'Z'
        }
    
    # Calculate value up to withdrawal date (includes partial final month)
    calculation = calculate_investment_value(investment, withdrawal_date, include_partial_month=True)
    
    return {
        'final_value': calculation['current_value'],
        'total_earnings': calculation['total_earnings'],
        'principal_amount': investment.get('amount', 0),
        'withdrawal_date': withdrawal_date or datetime.utcnow().isoformat() + 'Z',
        'months_elapsed': calculation['months_elapsed']
    }


def get_investment_status(investment: Dict, as_of_date: Optional[str] = None) -> Dict:
    """Get investment status with lockup information"""
    status = investment.get('status')
    
    if status == 'draft':
        return {
            'status': 'draft',
            'status_label': 'Draft',
            'is_active': False,
            'is_locked': False
        }
    
    if status == 'pending':
        return {
            'status': 'pending',
            'status_label': 'Pending',
            'is_active': False,
            'is_locked': True
        }
    
    if status == 'withdrawal_notice':
        return {
            'status': 'withdrawal_notice',
            'status_label': 'Withdrawal Processing',
            'is_active': False,
            'is_locked': True
        }
    
    if status == 'withdrawn':
        return {
            'status': 'withdrawn',
            'status_label': 'Withdrawn',
            'is_active': False,
            'is_locked': False
        }
    
    if status != 'active':
        return {
            'status': status,
            'status_label': 'Processing',
            'is_active': False,
            'is_locked': False
        }
    
    # Active investment - check lockup
    current_value = calculate_investment_value(investment, as_of_date)
    
    return {
        'status': 'active',
        'status_label': 'Available for Withdrawal' if current_value['is_withdrawable'] else 'Locked',
        'is_active': True,
        'is_locked': not current_value['is_withdrawable'],
        'lockup_end_date': current_value['lockup_end_date']
    }

