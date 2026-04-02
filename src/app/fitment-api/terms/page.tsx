import { Metadata } from 'next';
import { 
  LegalPageLayout, 
  LegalSection, 
  LegalSubsection,
  LegalList 
} from '@/components/fitment-api/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service | Fitment API',
  description: 'Terms of Service for the Fitment API. Read our terms before using the API.',
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="April 2, 2026">
      <p className="text-lg text-zinc-300 mb-8">
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Fitment API 
        (&quot;Service&quot;) provided by Warehouse Tire Direct (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). 
        By accessing or using the Service, you agree to be bound by these Terms.
      </p>

      <LegalSection number="1" title="Acceptance of Terms">
        <p>
          By requesting an API key, accessing the API, or using any data obtained through the Service, 
          you acknowledge that you have read, understood, and agree to be bound by these Terms. If you 
          are using the Service on behalf of an organization, you represent that you have the authority 
          to bind that organization to these Terms.
        </p>
        <p>
          If you do not agree to these Terms, you may not access or use the Service.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Description of Service">
        <p>
          The Fitment API provides programmatic access to vehicle fitment data, including but not limited to:
        </p>
        <LegalList items={[
          "Bolt patterns and center bore specifications",
          "OEM wheel and tire sizes",
          "Offset ranges and lug nut specifications",
          "Year, make, model, and trim information",
          "Staggered fitment detection"
        ]} />
        <p className="mt-4">
          The Service is designed for integration into tire and wheel retail applications, 
          ecommerce platforms, and related automotive industry tools.
        </p>
      </LegalSection>

      <LegalSection number="3" title="API Access & Authentication">
        <p>
          Access to the Service requires a valid API key issued by us. You are responsible for:
        </p>
        <LegalList items={[
          "Keeping your API key confidential and secure",
          "All activity that occurs under your API key",
          "Immediately notifying us if you suspect unauthorized use of your API key",
          "Not sharing, selling, or transferring your API key to third parties"
        ]} />
        <p className="mt-4">
          We reserve the right to revoke, suspend, or regenerate your API key at any time, 
          with or without notice, if we believe you have violated these Terms or for any other reason.
        </p>
      </LegalSection>

      <LegalSection number="4" title="Acceptable Use">
        <p>
          You agree to use the Service only for lawful purposes and in accordance with these Terms. 
          You may use the API to:
        </p>
        <LegalList items={[
          "Power vehicle fitment selectors on your website or application",
          "Display fitment information to your end users",
          "Validate wheel and tire compatibility for customer orders",
          "Enhance your product catalog with fitment data"
        ]} />

        <LegalSubsection title="Prohibited Uses">
          <p className="mb-3">You expressly agree NOT to:</p>
          <LegalList items={[
            "Scrape, bulk extract, or systematically download data from the API for the purpose of creating a local copy or mirror of the dataset",
            "Recreate, replicate, or reconstruct our fitment database in whole or in part",
            "Resell, redistribute, sublicense, or provide the raw API data to third parties",
            "Bypass, circumvent, or attempt to exceed rate limits or usage restrictions",
            "Use the API or its data to build a competing product or service",
            "Use the data for AI/ML model training, dataset aggregation, or machine learning purposes",
            "Access the API using automated means designed to extract data in bulk (including scripts, bots, or crawlers that systematically enumerate endpoints)",
            "Share API responses with third parties in raw or minimally modified form",
            "Cache API responses beyond what is necessary for reasonable application performance",
            "Misrepresent your identity, use case, or affiliation when requesting API access",
            "Use the Service in any way that violates applicable laws or regulations"
          ]} />
        </LegalSubsection>

        <p className="mt-4">
          We actively monitor API usage for violations of these Terms. Violations may result in 
          immediate termination of access and potential legal action.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Usage Limits">
        <p>
          API access is subject to rate limits and usage quotas based on your subscription tier:
        </p>
        <LegalList items={[
          "Requests per minute and per day limits apply to all accounts",
          "Burst limits restrict the number of requests per second",
          "Daily and monthly quotas may apply depending on your plan",
          "Exceeding limits may result in temporary throttling or suspension"
        ]} />
        <p className="mt-4">
          We reserve the right to modify usage limits at any time. We will make reasonable efforts 
          to notify you of material changes to your plan&apos;s limits.
        </p>
      </LegalSection>

      <LegalSection number="6" title="Monitoring & Enforcement">
        <p>
          We monitor API usage to ensure compliance with these Terms and to protect the integrity 
          of our Service. Our monitoring includes:
        </p>
        <LegalList items={[
          "Request patterns and frequency analysis",
          "Detection of systematic enumeration or bulk extraction attempts",
          "IP address and client identification tracking",
          "Abuse score calculation based on usage behavior"
        ]} />
        <p className="mt-4">
          If we detect suspicious activity or Terms violations, we may:
        </p>
        <LegalList items={[
          "Throttle your API access",
          "Temporarily suspend your API key",
          "Permanently revoke your API access",
          "Pursue legal remedies for damages"
        ]} />
      </LegalSection>

      <LegalSection number="7" title="Data Ownership">
        <p>
          All fitment data, database structures, and compiled information provided through the 
          Service are the exclusive property of Warehouse Tire Direct. You receive a limited, 
          non-exclusive, non-transferable license to use the data solely for the purposes 
          permitted under these Terms.
        </p>
        <p>
          You may not claim ownership of, or any intellectual property rights in, the data 
          provided through the API. Any derivative works that incorporate our data remain 
          subject to these Terms.
        </p>
      </LegalSection>

      <LegalSection number="8" title="No Guarantee of Completeness">
        <p>
          While we strive to maintain accurate and comprehensive fitment data, we do not 
          guarantee that the data is complete, current, or error-free. The Service is 
          provided &quot;as is&quot; and &quot;as available.&quot;
        </p>
        <p>
          You acknowledge that:
        </p>
        <LegalList items={[
          "Vehicle fitment data may contain inaccuracies or omissions",
          "OEM specifications may change without notice",
          "Not all vehicles or trim levels may be covered",
          "You are responsible for verifying fitment before making business decisions"
        ]} />
      </LegalSection>

      <LegalSection number="9" title="Service Availability">
        <p>
          We aim to provide reliable API availability but do not guarantee uninterrupted access. 
          The Service may be temporarily unavailable due to:
        </p>
        <LegalList items={[
          "Scheduled maintenance (we will provide reasonable notice when possible)",
          "Emergency maintenance or security updates",
          "Factors outside our control (network issues, third-party failures)",
          "Capacity constraints or service upgrades"
        ]} />
        <p className="mt-4">
          We are not liable for any losses resulting from Service unavailability.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW:
        </p>
        <LegalList items={[
          "WE PROVIDE THE SERVICE \"AS IS\" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED",
          "WE DISCLAIM ALL WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT",
          "WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES",
          "OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY YOU IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM"
        ]} />
        <p className="mt-4">
          You agree to indemnify and hold us harmless from any claims arising from your use 
          of the Service or violation of these Terms.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Termination">
        <p>
          Either party may terminate this agreement at any time. We may terminate or suspend 
          your access immediately, without prior notice, if:
        </p>
        <LegalList items={[
          "You breach any provision of these Terms",
          "We are required to do so by law",
          "We discontinue the Service",
          "We detect abuse, fraud, or security concerns"
        ]} />
        <p className="mt-4">
          Upon termination, your right to use the Service and any data obtained through it 
          ceases immediately. Sections 4 (Acceptable Use), 7 (Data Ownership), 10 (Limitation 
          of Liability), and 13 (Governing Law) survive termination.
        </p>
      </LegalSection>

      <LegalSection number="12" title="Changes to Terms">
        <p>
          We reserve the right to modify these Terms at any time. We will notify you of 
          material changes by:
        </p>
        <LegalList items={[
          "Posting the updated Terms on this page with a new \"Last Updated\" date",
          "Sending notice to the email associated with your API account",
          "Displaying a notice in your API dashboard (if applicable)"
        ]} />
        <p className="mt-4">
          Your continued use of the Service after changes become effective constitutes 
          acceptance of the revised Terms. If you do not agree to the changes, you must 
          stop using the Service.
        </p>
      </LegalSection>

      <LegalSection number="13" title="Governing Law">
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the 
          State of New York, without regard to its conflict of law provisions. Any disputes 
          arising under these Terms shall be resolved in the state or federal courts located 
          in New York, and you consent to the personal jurisdiction of such courts.
        </p>
      </LegalSection>

      <div className="mt-12 pt-8 border-t border-zinc-800">
        <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
        <p className="text-zinc-300">
          If you have questions about these Terms, please contact us at:{' '}
          <a href="mailto:api@warehousetiredirect.com" className="text-blue-400 hover:text-blue-300">
            api@warehousetiredirect.com
          </a>
        </p>
      </div>
    </LegalPageLayout>
  );
}
