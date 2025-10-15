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

### **2. Seed & Test Locally**
```bash
# Seed the data
npm run seed-wealthblock

# OR use Time Machine UI button "Seed Real Users"
```

### **3. Generate Activity**
- Use Time Machine to advance months/years
- Distributions are created automatically
- Compounding accumulates
- Monthly payouts are recorded

### **4. Keep Adding Users**
- Capture more Wealthblock data from screenshots
- Add to `WEALTHBLOCK_USERS` array
- Reseed and test

### **5. Export to Production (When Ready)**
- Export local database as CSV (TODO: build this feature)
- Go to Production Admin > Operations > Import Investors
- Upload CSV and import all users with full activity history

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

---

## 📊 **Production Deployment Plan**

### **Current State:**
✅ Local seeding with real data works  
✅ Time Machine generates realistic activity  
✅ Import Investors feature exists in production  
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
4. **Time Machine** - Generate months/years of activity
5. **Easy Deployment** - Export/import when ready

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

**Q: When can I deploy to production?**  
A: Once we build the CSV export feature, you can export your entire local database and import to production.

---

**Last Updated:** October 16, 2024

