import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { Resend } from "resend";
import { db } from "@/lib/fitment-db/db";
import { employmentApplications, type NewEmploymentApplication } from "@/lib/fitment-db/schema";

export const runtime = "nodejs";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function b(v: unknown): boolean {
  return v === true || v === "true" || v === "yes";
}

// Turnstile verification
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("[employment] TURNSTILE_SECRET_KEY not set, skipping verification");
    return true; // Allow in dev without Turnstile
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.error("[employment] Turnstile verification failed:", err);
    return false;
  }
}

// Generate HTML email for the application
function generateEmailHtml(app: Record<string, unknown>): string {
  const availability = app.availability as Record<string, { available?: boolean; startTime?: string; endTime?: string }> | undefined;
  const employmentHistory = app.employmentHistory as Array<{
    company?: string;
    position?: string;
    supervisor?: string;
    phone?: string;
    startDate?: string;
    endDate?: string;
    reasonForLeaving?: string;
    responsibilities?: string;
  }> | undefined;
  const references = app.references as Array<{
    name?: string;
    relationship?: string;
    phone?: string;
  }> | undefined;

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  const availabilityRows = days.map((day) => {
    const dayData = availability?.[day];
    if (dayData?.available) {
      return `<tr><td style="padding:8px;border:1px solid #ddd;text-transform:capitalize;">${day}</td><td style="padding:8px;border:1px solid #ddd;">${dayData.startTime || ""} - ${dayData.endTime || ""}</td></tr>`;
    }
    return `<tr><td style="padding:8px;border:1px solid #ddd;text-transform:capitalize;">${day}</td><td style="padding:8px;border:1px solid #ddd;color:#999;">Not Available</td></tr>`;
  }).join("");

  const employmentRows = employmentHistory?.map((emp, i) => `
    <div style="margin-bottom:20px;padding:15px;background:#f9f9f9;border-radius:8px;">
      <h4 style="margin:0 0 10px 0;color:#333;">Employer ${i + 1}: ${emp.company || "N/A"}</h4>
      <table style="width:100%;">
        <tr><td style="padding:4px 0;color:#666;width:140px;">Position:</td><td>${emp.position || "N/A"}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Supervisor:</td><td>${emp.supervisor || "N/A"}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Phone:</td><td>${emp.phone || "N/A"}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Dates:</td><td>${emp.startDate || "?"} - ${emp.endDate || "?"}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Reason for Leaving:</td><td>${emp.reasonForLeaving || "N/A"}</td></tr>
        <tr><td style="padding:4px 0;color:#666;vertical-align:top;">Responsibilities:</td><td>${emp.responsibilities || "N/A"}</td></tr>
      </table>
    </div>
  `).join("") || "<p style=\"color:#999;\">No employment history provided</p>";

  const referenceRows = references?.map((ref, i) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${i + 1}</td>
      <td style="padding:8px;border:1px solid #ddd;">${ref.name || "N/A"}</td>
      <td style="padding:8px;border:1px solid #ddd;">${ref.relationship || "N/A"}</td>
      <td style="padding:8px;border:1px solid #ddd;">${ref.phone || "N/A"}</td>
    </tr>
  `).join("") || "<tr><td colspan=\"4\" style=\"padding:8px;border:1px solid #ddd;color:#999;\">No references provided</td></tr>";

  const skillsList = [
    { key: "isAseCertified", label: "ASE Certified" },
    { key: "hasForkliftExperience", label: "Forklift Experience" },
    { key: "hasAlignmentExperience", label: "Alignment Experience" },
    { key: "hasTpmsExperience", label: "TPMS Experience" },
    { key: "hasMountingBalancingExperience", label: "Mounting & Balancing" },
    { key: "hasOilChangeExperience", label: "Oil Change" },
    { key: "hasBrakeExperience", label: "Brake Service" },
    { key: "hasSuspensionExperience", label: "Suspension Work" },
  ];

  const skillsHtml = skillsList
    .filter((skill) => app[skill.key] === true)
    .map((skill) => `<span style="display:inline-block;background:#22c55e;color:white;padding:4px 12px;border-radius:9999px;margin:4px;font-size:14px;">${skill.label}</span>`)
    .join("") || "<span style=\"color:#999;\">None specified</span>";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:800px;margin:0 auto;padding:20px;">
  
  <div style="background:linear-gradient(135deg,#dc2626,#991b1b);color:white;padding:30px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">New Employment Application</h1>
    <p style="margin:10px 0 0 0;opacity:0.9;">Warehouse Tire - ${app.preferredStore || "Any Location"}</p>
  </div>

  <div style="background:white;border:1px solid #e5e5e5;border-top:none;padding:30px;border-radius:0 0 12px 12px;">
    
    <!-- Personal Information -->
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Personal Information</h2>
      <table style="width:100%;">
        <tr><td style="padding:6px 0;color:#666;width:150px;"><strong>Name:</strong></td><td>${app.firstName} ${app.lastName}</td></tr>
        <tr><td style="padding:6px 0;color:#666;"><strong>Phone:</strong></td><td><a href="tel:${app.phone}">${app.phone}</a></td></tr>
        <tr><td style="padding:6px 0;color:#666;"><strong>Email:</strong></td><td><a href="mailto:${app.email}">${app.email}</a></td></tr>
        <tr><td style="padding:6px 0;color:#666;"><strong>Address:</strong></td><td>${app.streetAddress}<br>${app.city}, ${app.state} ${app.zip}</td></tr>
      </table>
    </div>

    <!-- Position Details -->
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Position Details</h2>
      <table style="width:100%;">
        <tr><td style="padding:6px 0;color:#666;width:150px;"><strong>Position:</strong></td><td style="font-weight:bold;color:#dc2626;">${app.positionApplyingFor}</td></tr>
        <tr><td style="padding:6px 0;color:#666;"><strong>Preferred Store:</strong></td><td>${app.preferredStore}</td></tr>
        <tr><td style="padding:6px 0;color:#666;"><strong>Desired Pay:</strong></td><td>${app.desiredPay || "Not specified"}</td></tr>
        <tr><td style="padding:6px 0;color:#666;"><strong>Available Start:</strong></td><td>${app.availableStartDate || "Not specified"}</td></tr>
        <tr><td style="padding:6px 0;color:#666;"><strong>Employment Type:</strong></td><td>${app.employmentType}</td></tr>
      </table>
    </div>

    <!-- Availability -->
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Availability</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Day</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Hours</th>
          </tr>
        </thead>
        <tbody>
          ${availabilityRows}
        </tbody>
      </table>
    </div>

    <!-- Qualifications -->
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Qualifications</h2>
      <table style="width:100%;">
        <tr>
          <td style="padding:6px 0;color:#666;width:250px;">Authorized to work in US:</td>
          <td>${app.authorizedToWork ? "✅ Yes" : "❌ No"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Reliable transportation:</td>
          <td>${app.hasReliableTransportation ? "✅ Yes" : "❌ No"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Valid driver's license:</td>
          <td>${app.hasValidDriversLicense ? "✅ Yes" : "❌ No"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Worked here before:</td>
          <td>${app.workedHereBefore ? `✅ Yes - ${app.workedHereBeforeExplanation || ""}` : "❌ No"}</td>
        </tr>
      </table>
    </div>

    <!-- Experience -->
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Experience</h2>
      <table style="width:100%;">
        <tr><td style="padding:6px 0;color:#666;width:200px;">Automotive Experience:</td><td>${app.yearsAutomotiveExperience || "0"} years</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Tire Experience:</td><td>${app.yearsTireExperience || "0"} years</td></tr>
        <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Customer Service:</td><td>${app.customerServiceExperience || "Not specified"}</td></tr>
        <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Sales Experience:</td><td>${app.salesExperience || "Not specified"}</td></tr>
      </table>
      
      <h3 style="margin-top:20px;margin-bottom:10px;color:#333;">Skills & Certifications</h3>
      <div>${skillsHtml}</div>
    </div>

    <!-- Employment History -->
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Employment History</h2>
      ${employmentRows}
    </div>

    <!-- Education -->
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Education</h2>
      <p style="margin:0;"><strong>Highest Level Completed:</strong> ${app.highestEducation || "Not specified"}</p>
    </div>

    <!-- References -->
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">References</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px;border:1px solid #ddd;text-align:left;width:30px;">#</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Name</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Relationship</th>
            <th style="padding:10px;border:1px solid #ddd;text-align:left;">Phone</th>
          </tr>
        </thead>
        <tbody>
          ${referenceRows}
        </tbody>
      </table>
    </div>

    <!-- Resume -->
    ${app.resumeUrl ? `
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Resume</h2>
      <a href="${app.resumeUrl}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">📄 Download Resume (${app.resumeFilename || "resume"})</a>
    </div>
    ` : ""}

    <!-- How did you hear about us -->
    ${app.heardAboutUs ? `
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">How Did You Hear About Us?</h2>
      <p style="margin:0;">${app.heardAboutUs}</p>
    </div>
    ` : ""}

    <!-- Additional Comments -->
    ${app.additionalComments ? `
    <div style="margin-bottom:30px;">
      <h2 style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:8px;margin-bottom:15px;">Additional Comments</h2>
      <p style="margin:0;white-space:pre-wrap;">${app.additionalComments}</p>
    </div>
    ` : ""}

    <!-- Certification -->
    <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin-top:30px;">
      <h3 style="margin:0 0 10px 0;color:#333;">Certification</h3>
      <p style="margin:0 0 10px 0;"><strong>Electronic Signature:</strong> ${app.electronicSignature}</p>
      <p style="margin:0 0 10px 0;"><strong>Date:</strong> ${app.signatureDate}</p>
      <p style="margin:0;font-size:14px;color:#666;">Applicant certified that all information provided is true and complete.</p>
    </div>

  </div>

  <p style="text-align:center;color:#999;font-size:12px;margin-top:20px;">
    Application submitted on ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} EST
  </p>

</body>
</html>
  `.trim();
}

// Generate confirmation email HTML
function generateConfirmationHtml(firstName: string, position: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  
  <div style="background:linear-gradient(135deg,#dc2626,#991b1b);color:white;padding:30px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;">Application Received!</h1>
  </div>

  <div style="background:white;border:1px solid #e5e5e5;border-top:none;padding:30px;border-radius:0 0 12px 12px;">
    
    <p style="font-size:18px;">Hi ${firstName},</p>
    
    <p>Thank you for applying for the <strong>${position}</strong> position at Warehouse Tire!</p>
    
    <p>We've received your application and our team will review it carefully. If your qualifications match our current openings, someone from Warehouse Tire will contact you.</p>

    <div style="background:#f3f4f6;padding:20px;border-radius:8px;margin:20px 0;">
      <h3 style="margin:0 0 10px 0;color:#333;">What's Next?</h3>
      <ul style="margin:0;padding-left:20px;">
        <li>Our hiring team will review your application</li>
        <li>If selected, we'll contact you for an interview</li>
        <li>Feel free to apply for other positions if interested</li>
      </ul>
    </div>

    <p>If you have any questions, feel free to call us:</p>
    <ul style="margin:0;padding-left:20px;">
      <li><strong>Pontiac:</strong> <a href="tel:248-332-4120">(248) 332-4120</a></li>
      <li><strong>Waterford:</strong> <a href="tel:248-683-0070">(248) 683-0070</a></li>
    </ul>

    <p style="margin-top:30px;">Best regards,<br><strong>The Warehouse Tire Team</strong></p>

  </div>

  <p style="text-align:center;color:#999;font-size:12px;margin-top:20px;">
    Warehouse Tire | Pontiac & Waterford, Michigan
  </p>

</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    // Get IP for rate limiting and Turnstile
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // Parse form data (multipart for file upload)
    const formData = await req.formData();
    
    // Extract Turnstile token
    const turnstileToken = formData.get("turnstileToken") as string;
    
    // Verify Turnstile
    if (turnstileToken) {
      const isValid = await verifyTurnstile(turnstileToken, ip);
      if (!isValid) {
        return NextResponse.json(
          { ok: false, error: "Security verification failed. Please try again." },
          { status: 400 }
        );
      }
    }

    // Honeypot check
    const honeypot = s(formData.get("website"));
    if (honeypot) {
      // Bot detected - pretend success
      return NextResponse.json({ ok: true });
    }

    // Extract all form fields
    const firstName = s(formData.get("firstName"));
    const lastName = s(formData.get("lastName"));
    const phone = s(formData.get("phone"));
    const email = s(formData.get("email"));
    const streetAddress = s(formData.get("streetAddress"));
    const city = s(formData.get("city"));
    const state = s(formData.get("state"));
    const zip = s(formData.get("zip"));
    const positionApplyingFor = s(formData.get("positionApplyingFor"));
    const preferredStore = s(formData.get("preferredStore"));
    const desiredPay = s(formData.get("desiredPay"));
    const availableStartDate = s(formData.get("availableStartDate"));
    const employmentType = s(formData.get("employmentType"));
    const authorizedToWork = b(formData.get("authorizedToWork"));
    const hasReliableTransportation = b(formData.get("hasReliableTransportation"));
    const hasValidDriversLicense = b(formData.get("hasValidDriversLicense"));
    const workedHereBefore = b(formData.get("workedHereBefore"));
    const workedHereBeforeExplanation = s(formData.get("workedHereBeforeExplanation"));
    const yearsAutomotiveExperience = s(formData.get("yearsAutomotiveExperience"));
    const yearsTireExperience = s(formData.get("yearsTireExperience"));
    const customerServiceExperience = s(formData.get("customerServiceExperience"));
    const salesExperience = s(formData.get("salesExperience"));
    const isAseCertified = b(formData.get("isAseCertified"));
    const hasForkliftExperience = b(formData.get("hasForkliftExperience"));
    const hasAlignmentExperience = b(formData.get("hasAlignmentExperience"));
    const hasTpmsExperience = b(formData.get("hasTpmsExperience"));
    const hasMountingBalancingExperience = b(formData.get("hasMountingBalancingExperience"));
    const hasOilChangeExperience = b(formData.get("hasOilChangeExperience"));
    const hasBrakeExperience = b(formData.get("hasBrakeExperience"));
    const hasSuspensionExperience = b(formData.get("hasSuspensionExperience"));
    const highestEducation = s(formData.get("highestEducation"));
    const heardAboutUs = s(formData.get("heardAboutUs"));
    const additionalComments = s(formData.get("additionalComments"));
    const certificationAgreed = b(formData.get("certificationAgreed"));
    const electronicSignature = s(formData.get("electronicSignature"));
    const signatureDate = s(formData.get("signatureDate"));

    // Parse availability JSON
    const availabilityStr = s(formData.get("availability"));
    let availability = null;
    if (availabilityStr) {
      try {
        availability = JSON.parse(availabilityStr);
      } catch {
        // Ignore parse errors
      }
    }

    // Parse employment history JSON
    const employmentHistoryStr = s(formData.get("employmentHistory"));
    let employmentHistory = null;
    if (employmentHistoryStr) {
      try {
        employmentHistory = JSON.parse(employmentHistoryStr);
      } catch {
        // Ignore parse errors
      }
    }

    // Parse references JSON
    const referencesStr = s(formData.get("references"));
    let references = null;
    if (referencesStr) {
      try {
        references = JSON.parse(referencesStr);
      } catch {
        // Ignore parse errors
      }
    }

    // Validate required fields
    if (!firstName || !lastName || !phone || !email || !streetAddress || !city || !state || !zip) {
      return NextResponse.json(
        { ok: false, error: "Please fill in all required personal information fields." },
        { status: 400 }
      );
    }

    if (!positionApplyingFor || !preferredStore || !employmentType) {
      return NextResponse.json(
        { ok: false, error: "Please fill in all required position fields." },
        { status: 400 }
      );
    }

    if (!certificationAgreed || !electronicSignature || !signatureDate) {
      return NextResponse.json(
        { ok: false, error: "Please complete the certification and signature." },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { ok: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Handle resume upload
    let resumeUrl: string | null = null;
    let resumeFilename: string | null = null;
    
    const resumeFile = formData.get("resume") as File | null;
    if (resumeFile && resumeFile.size > 0) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!allowedTypes.includes(resumeFile.type)) {
        return NextResponse.json(
          { ok: false, error: "Resume must be a PDF, DOC, or DOCX file." },
          { status: 400 }
        );
      }

      // Validate file size (10MB max)
      if (resumeFile.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: "Resume file must be under 10MB." },
          { status: 400 }
        );
      }

      // Upload to Vercel Blob
      try {
        const timestamp = Date.now();
        const safeName = `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${timestamp}`;
        const ext = resumeFile.name.split(".").pop() || "pdf";
        const blobPath = `employment-resumes/${safeName}.${ext}`;

        const blob = await put(blobPath, resumeFile, {
          access: "public",
          contentType: resumeFile.type,
        });

        resumeUrl = blob.url;
        resumeFilename = resumeFile.name;
      } catch (err) {
        console.error("[employment] Resume upload failed:", err);
        // Continue without resume - don't fail the whole application
      }
    }

    // Duplicate check - same email + position in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await db.query.employmentApplications.findFirst({
      where: (t, { and, eq, gt }) =>
        and(
          eq(t.email, email.toLowerCase()),
          eq(t.positionApplyingFor, positionApplyingFor),
          gt(t.createdAt, oneDayAgo)
        ),
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: "You've already submitted an application for this position. Please wait 24 hours before reapplying." },
        { status: 400 }
      );
    }

    // Build the application record
    const applicationData: NewEmploymentApplication = {
      firstName,
      lastName,
      phone,
      email: email.toLowerCase(),
      streetAddress,
      city,
      state,
      zip,
      positionApplyingFor,
      preferredStore,
      desiredPay: desiredPay || null,
      availableStartDate: availableStartDate || null,
      employmentType,
      availability,
      authorizedToWork,
      hasReliableTransportation,
      hasValidDriversLicense,
      workedHereBefore,
      workedHereBeforeExplanation: workedHereBeforeExplanation || null,
      yearsAutomotiveExperience: yearsAutomotiveExperience || null,
      yearsTireExperience: yearsTireExperience || null,
      customerServiceExperience: customerServiceExperience || null,
      salesExperience: salesExperience || null,
      isAseCertified,
      hasForkliftExperience,
      hasAlignmentExperience,
      hasTpmsExperience,
      hasMountingBalancingExperience,
      hasOilChangeExperience,
      hasBrakeExperience,
      hasSuspensionExperience,
      employmentHistory,
      highestEducation: highestEducation || null,
      references,
      resumeUrl,
      resumeFilename,
      heardAboutUs: heardAboutUs || null,
      additionalComments: additionalComments || null,
      certificationAgreed,
      electronicSignature,
      signatureDate,
      status: "new",
      ipAddress: ip,
      userAgent: userAgent.substring(0, 500),
      turnstileToken: turnstileToken?.substring(0, 2000) || null,
    };

    // Save to database
    const [inserted] = await db
      .insert(employmentApplications)
      .values(applicationData)
      .returning();

    console.log(`[employment] Application saved: ${inserted.id} - ${firstName} ${lastName} for ${positionApplyingFor}`);

    // Send notification email to management
    try {
      const RESEND_API_KEY = required("RESEND_API_KEY");
      const RESEND_FROM = required("RESEND_FROM");
      const EMPLOYMENT_TO = process.env.EMPLOYMENT_TO || process.env.CONTACT_TO || "scott@warehousetire.net";

      const resend = new Resend(RESEND_API_KEY);

      // Build email data for HTML generation
      const emailData: Record<string, unknown> = {
        ...applicationData,
        resumeUrl,
        resumeFilename,
      };

      const emailSubject = `New Employment Application - ${firstName} ${lastName}`;
      const emailHtml = generateEmailHtml(emailData);

      await resend.emails.send({
        from: RESEND_FROM,
        to: EMPLOYMENT_TO,
        replyTo: email,
        subject: emailSubject,
        html: emailHtml,
      });

      console.log(`[employment] Notification email sent to ${EMPLOYMENT_TO}`);
    } catch (emailErr) {
      console.error("[employment] Failed to send notification email:", emailErr);
      // Don't fail the request - application is saved
    }

    // Send confirmation email to applicant
    try {
      const RESEND_API_KEY = required("RESEND_API_KEY");
      const RESEND_FROM = required("RESEND_FROM");

      const resend = new Resend(RESEND_API_KEY);

      const confirmationHtml = generateConfirmationHtml(firstName, positionApplyingFor);

      await resend.emails.send({
        from: RESEND_FROM,
        to: email,
        subject: `Application Received - Warehouse Tire`,
        html: confirmationHtml,
      });

      console.log(`[employment] Confirmation email sent to ${email}`);
    } catch (confirmErr) {
      console.error("[employment] Failed to send confirmation email:", confirmErr);
      // Don't fail the request - application is saved
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (e: unknown) {
    console.error("[employment] Error:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}