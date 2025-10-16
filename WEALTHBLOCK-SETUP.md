# 🔒 Wealthblock Real Data Setup

## First Time Setup

If `lib/seedWealthblockAccounts.js` doesn't exist (it's gitignored), create it:

```bash
cp lib/seedWealthblockAccounts.template.js lib/seedWealthblockAccounts.js
```

Then replace the template data with REAL Wealthblock user data.

---

## 📋 **Simple Workflow**

### **1. Keep Real Data Locally**
- Edit `lib/seedWealthblockAccounts.js` with REAL Wealthblock data
- This file is **GITIGNORED** - it will NEVER be committed
- Safe to keep real names, addresses, phone numbers, etc.

### **2. Test with Time Machine**
Instead of pre-generating historical data, use Time Machine to test naturally:

1. **Roll back time** to when investments started (e.g., Oct 13, 2024)
2. **Seed Wealthblock accounts** at that historical date
3. **Advance time month-by-month** 
4. **Approve distributions** as they occur

This tests your system's ACTUAL behavior over time!

### **3. Quick Seed & Test**
```bash
# Seed the data (without historical distributions)
npm run seed-wealthblock

# OR use Time Machine UI button "Seed Real Users"
```

### **4. Approve Distributions**
Go to **Admin → Distributions → [Month] → Show Pending Only → Approve All Pending Payouts**

This bulk-approves all pending monthly distributions at once.

### **5. Keep Adding Users**
- Capture more Wealthblock data from screenshots
- Add to `WEALTHBLOCK_USERS` array
- Reseed and test

### **6. Export to Production (When Ready)**
- Export local database as CSV (TODO: build this feature)
- Go to Production Admin > Operations > Import Investors
- Upload CSV and import all users with full activity history

---

## 🧪 **Testing Workflow**

See detailed instructions in: **[WEALTHBLOCK-TESTING-WORKFLOW.md](./WEALTHBLOCK-TESTING-WORKFLOW.md)**

**Quick Summary:**
1. Delete test accounts
2. Set Time Machine to Oct 13, 2024, 08:00 AM
3. Click "Seed Real Users"
4. Advance time to Dec 1, 2024
5. Approve November distributions
6. Advance to Jan 1, 2025
7. Approve December distributions
8. Repeat for each month...

---

## 🔐 **Security**

### **Files That Are GITIGNORED (Safe for Real Data):**
- ✅ `lib/seedWealthblockAccounts.js` - Your actual seed file with real data
- ✅ `RESTORE-REAL-DATA.md` - Backup of real data
- ✅ `PRE-COMMIT-CHECKLIST.txt` - Not needed with this workflow
- ✅ `/data/*` - Local database files

### **Files That ARE Committed (No Real Data):**
- 📝 `lib/seedWealthblockAccounts.template.js` - Template for structure
- 📝 `docs/WEALTHBLOCK-SEED-GUIDE.md` - Full documentation
- 📝 `SECURITY-CHECKLIST.md` - Security guide
- 📝 This file - `WEALTHBLOCK-SETUP.md`
- 📝 `WEALTHBLOCK-TESTING-WORKFLOW.md` - Step-by-step testing guide

---

## 📊 **Production Deployment Plan**

### **Current State:**
✅ Local seeding with real data works  
✅ Time Machine generates realistic activity  
✅ Import Investors feature exists in production  
✅ Bulk approve pending distributions  
⏳ Need to build CSV export feature  

### **When Export Feature is Ready:**

1. **Local:** Click "Export Database as CSV" in admin
2. **Download:** CSV with all users, investments, and activity
3. **Production:** Upload via Import Investors
4. **Done:** All your test data is now in production

---

## 🎯 **Benefits of This Approach**

1. **No Git Pollution** - Real data never touches Git history
2. **Simple Workflow** - Just edit one file and seed
3. **Realistic Testing** - Use actual Wealthblock data patterns
4. **Natural Behavior** - Test system's time-based logic naturally
5. **Time Machine** - Generate months/years of activity
6. **Bulk Operations** - Approve all distributions at once
7. **Easy Deployment** - Export/import when ready

---

## 🆘 **Troubleshooting**

**Q: File doesn't exist after git clone?**  
A: That's expected! Copy from template:
```bash
cp lib/seedWealthblockAccounts.template.js lib/seedWealthblockAccounts.js
```

**Q: Can I commit my changes?**  
A: The seed file is gitignored, so your real data will never be committed. Other files are safe to commit.

**Q: How do I add more users?**  
A: Edit `lib/seedWealthblockAccounts.js`, add to the `WEALTHBLOCK_USERS` array, and reseed.

**Q: How do I approve all pending distributions?**  
A: Go to Admin → Distributions → [Select Month] → Toggle "Show Pending Only" → Click "Approve All Pending Payouts"

**Q: When can I deploy to production?**  
A: Once we build the CSV export feature, you can export your entire local database and import to production.

---

**Last Updated:** December 16, 2024
