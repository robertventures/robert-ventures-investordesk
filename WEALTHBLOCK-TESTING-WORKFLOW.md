# Wealthblock Testing Workflow

## 🎯 **Goal**
Test the system's natural behavior over time using real Wealthblock data by:
1. Rolling back time to when investments started
2. Adding real user data
3. Advancing time month-by-month
4. Approving distributions as they occur

---

## 📋 **Step-by-Step Workflow**

### **Step 1: Prepare the System**
```bash
# Delete all test accounts (from Admin → Operations → Delete Test Accounts)
```

### **Step 2: Roll Back Time**
1. Go to **Admin Panel → Operations → Time Machine**
2. Set date to **October 13, 2024** (when first Wealthblock investment started)
3. Set time to **08:00 AM** (before investments)
4. Click **"Set App Time"**

### **Step 3: Seed Wealthblock Accounts**
1. In **Admin Panel → Operations → Time Machine**
2. Click **"Seed Real Users"** button
3. This will create Joseph Robert's account at the historical date

### **Step 4: Verify Account Created**
1. Go to **Admin → Users**
2. Verify Joseph Robert exists with:
   - Account Created: Oct 13, 2024, 08:00 AM
   - Investment 1 (Compounding): Oct 13, 2024, 12:35 PM
   - Investment 2 (Monthly): Nov 21, 2024, 09:09 AM

### **Step 5: Advance Time Month-by-Month**

#### **November 2024** (First Distributions)
1. Set Time Machine to **December 1, 2024, 09:00 AM**
2. Go to **Admin → Distributions**
3. Click on **"November 2024"** month
4. Toggle **"Show Pending Only"**
5. Click **"Approve All Pending Payouts"**
6. Verify distributions are now marked as "received"

#### **December 2024**
1. Set Time Machine to **January 1, 2025, 09:00 AM**
2. Go to **Admin → Distributions → December 2024**
3. Toggle **"Show Pending Only"**
4. Click **"Approve All Pending Payouts"**

#### **Continue for Each Month...**
Repeat for:
- January 2025
- February 2025
- March 2025
- April 2025
- May 2025
- June 2025
- July 2025
- August 2025
- September 2025
- October 2025 (present)

---

## ✅ **What to Verify at Each Step**

### **Dashboard Metrics**
- Total Invested increases correctly
- Total Earnings accumulates
- Current Value = Invested + Earnings (for monthly) or compounded value

### **User Activity Feed**
- Chronological order (oldest first):
  1. Account Created
  2. Investment Created
  3. Investment Approved
  4. Investment Confirmed
  5. Distribution (Month 1)
  6. Distribution (Month 2)
  7. etc.

### **Investment Details**
- **Compounding Investment (INV-20000):**
  - Each month: Distribution + Contribution
  - Principal grows each month
  - All marked as "received"
  
- **Monthly Payout Investment (INV-20001):**
  - Each month: Distribution only
  - Principal stays constant
  - Distributions approved and marked as "received"

### **Pending Payouts**
- After Time Machine advance: Should show new pending distributions
- After "Approve All": Should be empty

---

## 🧪 **What This Tests**

✅ **Proration Logic**: First partial month calculations  
✅ **Distribution Generation**: Monthly schedule accuracy  
✅ **Compounding Logic**: Principal growth calculations  
✅ **Time Machine Behavior**: Historical data generation  
✅ **Admin Approval Flow**: Bulk approval process  
✅ **Activity Timeline**: Event ordering  
✅ **Dashboard Calculations**: Real-time metrics  

---

## 💡 **Tips**

1. **Take Screenshots**: Document each month's state for comparison
2. **Check Calculations**: Verify distribution amounts match expected 10% APR
3. **Watch for Edge Cases**: 
   - Leap years
   - Month-end dates
   - Partial month prorations
4. **Monitor Performance**: Check how system handles 12+ months of data

---

## 🎯 **Expected Results**

By the end (October 2025):
- **Investment 1 (Compounding)**: ~12 distributions/contributions, growing principal
- **Investment 2 (Monthly)**: ~11 distributions (started Nov 21)
- **Total Distributions**: ~23 events
- **All Status**: "received" (approved)
- **Activity Feed**: 30+ chronological events

---

## 🚀 **Export to Production**

Once testing is complete:
1. Go to **Admin → Operations → Import Investors**
2. Export current data as CSV
3. Upload to production system
4. All historical distributions will be marked as completed

---

## ⚠️ **Important Notes**

- Always use Time Machine for historical testing
- Never commit real PII to git
- Use bulk approve for efficiency
- Verify calculations at each step
- Document any discrepancies

---

## 📞 **Support**

If you encounter issues:
1. Check console logs for errors
2. Verify Time Machine date is set correctly
3. Run `POST /api/migrate-transactions` manually if needed
4. Check `data/users.json` for transaction states

