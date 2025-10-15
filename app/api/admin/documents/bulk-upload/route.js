import { NextResponse } from 'next/server'
import { getUsers, updateUser } from '../../../../../lib/database'
import { uploadDocument, generateDocumentKey, isPDF } from '../../../../../lib/documentStorage'
import { sendDocumentNotification } from '../../../../../lib/emailService'
import { generateTransactionId } from '../../../../../lib/idGenerator'
import { requireAdmin, authErrorResponse } from '../../../../../lib/authMiddleware'
import JSZip from 'jszip'

/**
 * POST /api/admin/documents/bulk-upload
 * 
 * Bulk upload documents from a ZIP file
 * Files should be named: FirstnameLastname_*.pdf (e.g., JosephRobert_7273_2.pdf)
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const formData = await request.formData()
    const zipFile = formData.get('file')

    if (!zipFile) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Auto-set year to current year for organizational purposes
    const year = new Date().getFullYear().toString()

    const usersData = await getUsers()

    // Parse ZIP file
    const arrayBuffer = await zipFile.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)
    
    const results = {
      autoMatched: [],
      duplicateNames: [],
      noMatch: [],
      errors: []
    }

    // Process each PDF in the ZIP
    const pdfFiles = Object.keys(zip.files).filter(
      filename => filename.toLowerCase().endsWith('.pdf') && !filename.startsWith('__MACOSX')
    )

    for (const filename of pdfFiles) {
      try {
        const file = zip.files[filename]
        const pdfData = await file.async('arraybuffer')
        
        // Validate PDF
        if (!isPDF(pdfData)) {
          results.errors.push({
            filename,
            error: 'Invalid PDF file'
          })
          continue
        }

        // Extract name from filename (before first underscore or number)
        const baseName = filename.split('/').pop() // Handle folder structures
        const nameMatch = baseName.match(/^([A-Za-z]+)([A-Za-z]+)/)
        
        if (!nameMatch) {
          results.noMatch.push({
            filename: baseName,
            reason: 'Could not parse name from filename'
          })
          continue
        }

        const firstName = nameMatch[1]
        const lastName = nameMatch[2]

        // Find matching users (case-insensitive)
        const matchingUsers = usersData.users.filter(u => 
          !u.isAdmin &&
          u.firstName.toLowerCase() === firstName.toLowerCase() &&
          u.lastName.toLowerCase() === lastName.toLowerCase()
        )

        if (matchingUsers.length === 0) {
          results.noMatch.push({
            filename: baseName,
            firstName,
            lastName,
            reason: 'No user found with this name'
          })
        } else if (matchingUsers.length > 1) {
          results.duplicateNames.push({
            filename: baseName,
            firstName,
            lastName,
            matchingUsers: matchingUsers.map(u => ({
              id: u.id,
              email: u.email,
              createdAt: u.createdAt,
              lastInvestmentDate: u.investments?.[u.investments.length - 1]?.createdAt || null
            }))
          })
        } else {
          // Unique match - auto-upload
          const user = matchingUsers[0]
          
          // No duplicate checking - allow multiple documents per user
          
          // Upload to blob storage
          const blobKey = generateDocumentKey('documents', year, user.id, baseName)
          const uploadResult = await uploadDocument(blobKey, pdfData, 'application/pdf')

          if (!uploadResult.success) {
            results.errors.push({
              filename: baseName,
              userId: user.id,
              error: uploadResult.error
            })
            continue
          }

          // Update user record
          const documentId = generateTransactionId('DOC', user.id, 'document')
          const newDocument = {
            id: documentId,
            type: 'document',
            fileName: baseName,
            year,
            uploadedAt: new Date().toISOString(),
            uploadedBy: adminUser.id,
            blobKey
          }

          const documents = user.documents || []
          documents.push(newDocument)

          await updateUser(user.id, { documents })

          // Send email notification
          const emailResult = await sendDocumentNotification({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          })

          results.autoMatched.push({
            filename: baseName,
            userId: user.id,
            email: user.email,
            emailSent: emailResult.success
          })
        }
      } catch (error) {
        results.errors.push({
          filename,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: pdfFiles.length,
        autoMatched: results.autoMatched.length,
        duplicateNames: results.duplicateNames.length,
        noMatch: results.noMatch.length,
        errors: results.errors.length
      },
      results
    })

  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

