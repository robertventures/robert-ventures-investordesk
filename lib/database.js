import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')
const usersFile = path.join(dataDir, 'users.json')

// Initialize database files
function initializeDatabase() {
  try {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    // Initialize users file if it doesn't exist
    if (!fs.existsSync(usersFile)) {
      fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2))
      console.log('Database initialized at:', usersFile)
    }
  } catch (error) {
    console.error('Error initializing database:', error)
  }
}

// Read users from file
export function getUsers() {
  try {
    initializeDatabase()
    const data = fs.readFileSync(usersFile, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading users file:', error)
    return { users: [] }
  }
}

// Save users to file
export function saveUsers(usersData) {
  try {
    initializeDatabase()
    fs.writeFileSync(usersFile, JSON.stringify(usersData, null, 2))
    console.log('Users data saved successfully')
    return true
  } catch (error) {
    console.error('Error saving users file:', error)
    return false
  }
}

// Add a new user
export function addUser(userData) {
  const usersData = getUsers()
  const newUser = {
    id: Date.now().toString(), // Simple ID generation
    email: userData.email,
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    phoneNumber: userData.phoneNumber || '',
    dob: userData.dob || '',
    ssn: userData.ssn || '',
    password: userData.password || '',
    address: userData.address || null,
    acknowledgements: userData.acknowledgements || null,
    verificationCode: userData.verificationCode || '',
    isVerified: userData.isVerified || false,
    verifiedAt: userData.verifiedAt || null,
    investments: [],
    notifications: Array.isArray(userData.notifications) ? userData.notifications : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  usersData.users.push(newUser)
  
  if (saveUsers(usersData)) {
    console.log('New user added:', newUser)
    return { success: true, user: newUser }
  } else {
    return { success: false, error: 'Failed to save user data' }
  }
}

// Get user by email
export function getUserByEmail(email) {
  const usersData = getUsers()
  return usersData.users.find(user => user.email === email)
}

// Update user data
export function updateUser(userId, updateData) {
  const usersData = getUsers()
  const userIndex = usersData.users.findIndex(user => user.id === userId)
  
  if (userIndex === -1) {
    console.log('User not found with ID:', userId)
    return { success: false, error: 'User not found' }
  }
  
  const updatedUser = {
    ...usersData.users[userIndex],
    ...updateData,
    updatedAt: new Date().toISOString()
  }
  
  usersData.users[userIndex] = updatedUser
  
  if (saveUsers(usersData)) {
    console.log('User updated:', updatedUser)
    return { success: true, user: updatedUser }
  } else {
    return { success: false, error: 'Failed to update user data' }
  }
}
