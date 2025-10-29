"""
Calculation Tests
Test investment calculations for penny-perfect accuracy
"""

import pytest
from services.calculations import (
    calculate_investment_value,
    calculate_months_elapsed,
    build_accrual_segments,
    to_utc_start_of_day
)


class TestCompoundingCalculations:
    """Test compounding interest calculations"""
    
    def test_simple_compounding_1year(self):
        """Test 3 months of 1-year compounding"""
        investment = {
            'amount': 10000,
            'paymentFrequency': 'compounding',
            'lockupPeriod': '1-year',
            'confirmedAt': '2024-01-01T00:00:00Z',
            'status': 'active'
        }
        
        result = calculate_investment_value(
            investment,
            as_of_date='2024-04-01T00:00:00Z'
        )
        
        # Expected values from JavaScript implementation
        # Month 1: $10,000 + $66.67 = $10,066.67
        # Month 2: $10,066.67 + $67.11 = $10,133.78
        # Month 3: $10,133.78 + $67.56 = $10,201.34
        assert result['current_value'] == 10201.34
        assert result['total_earnings'] == 201.34
        assert result['months_elapsed'] == 3.0
        assert result['is_withdrawable'] == False
    
    def test_simple_compounding_3year(self):
        """Test 3 months of 3-year compounding"""
        investment = {
            'amount': 10000,
            'paymentFrequency': 'compounding',
            'lockupPeriod': '3-year',
            'confirmedAt': '2024-01-01T00:00:00Z',
            'status': 'active'
        }
        
        result = calculate_investment_value(
            investment,
            as_of_date='2024-04-01T00:00:00Z'
        )
        
        # 10% APY = 0.833333% monthly
        # Month 1: $10,000 + $83.33 = $10,083.33
        # Month 2: $10,083.33 + $84.03 = $10,167.36
        # Month 3: $10,167.36 + $84.73 = $10,252.09
        assert result['current_value'] == 10252.09
        assert result['total_earnings'] == 252.09
        assert result['months_elapsed'] == 3.0


class TestMonthlyPayoutCalculations:
    """Test monthly payout calculations"""
    
    def test_monthly_payout_1year(self):
        """Test 3 months of 1-year monthly payout"""
        investment = {
            'amount': 10000,
            'paymentFrequency': 'monthly',
            'lockupPeriod': '1-year',
            'confirmedAt': '2024-01-01T00:00:00Z',
            'status': 'active'
        }
        
        result = calculate_investment_value(
            investment,
            as_of_date='2024-04-01T00:00:00Z'
        )
        
        # Monthly interest: $10,000 × 0.08 / 12 = $66.67
        # 3 months: $66.67 × 3 = $200.01
        # Principal unchanged: $10,000
        assert result['current_value'] == 10000.00
        assert result['total_earnings'] == 200.01
        assert result['monthly_interest_amount'] == 66.67


class TestEdgeCases:
    """Test edge cases and boundary conditions"""
    
    def test_same_day_calculation(self):
        """Test calculation on confirmation date"""
        investment = {
            'amount': 10000,
            'paymentFrequency': 'compounding',
            'lockupPeriod': '1-year',
            'confirmedAt': '2024-01-15T00:00:00Z',
            'status': 'active'
        }
        
        # Calculating on same day as confirmation
        result = calculate_investment_value(
            investment,
            as_of_date='2024-01-15T00:00:00Z'
        )
        
        # No interest yet (accrual starts next day)
        assert result['current_value'] == 10000.00
        assert result['total_earnings'] == 0.00
        assert result['months_elapsed'] == 0.0
    
    def test_lockup_end_date(self):
        """Test lockup end date calculation"""
        investment = {
            'amount': 10000,
            'paymentFrequency': 'compounding',
            'lockupPeriod': '1-year',
            'confirmedAt': '2024-01-15T00:00:00Z',
            'status': 'active'
        }
        
        result = calculate_investment_value(investment)
        
        # Should be exactly 1 year later
        assert '2025-01-15' in result['lockup_end_date']
        
        # Test before lockup ends
        result_before = calculate_investment_value(
            investment,
            as_of_date='2025-01-14T00:00:00Z'
        )
        assert result_before['is_withdrawable'] == False
        
        # Test after lockup ends
        result_after = calculate_investment_value(
            investment,
            as_of_date='2025-01-16T00:00:00Z'
        )
        assert result_after['is_withdrawable'] == True


# Run tests with: pytest tests/test_calculations.py -v

