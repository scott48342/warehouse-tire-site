import { Metadata } from 'next';
import { 
  LegalPageLayout, 
  LegalSection, 
  LegalSubsection,
  LegalList 
} from '@/components/fitment-api/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy | Fitment API',
  description: 'Privacy Policy for the Fitment API. Learn how we collect, use, and protect your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="April 2, 2026">
      <p className="text-lg text-zinc-300 mb-8">
        This Privacy Policy describes how Warehouse Tire Direct (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) 
        collects, uses, and protects information from users of the Fitment API (&quot;Service&quot;). 
        By using our Service, you consent to the data practices described in this policy.
      </p>

      <LegalSection number="1" title="Information We Collect">
        <LegalSubsection title="Account Information">
          <p>When you request API access, we collect:</p>
          <LegalList items={[
            "Your name",
            "Email address",
            "Company or organization name",
            "Business type and intended use case",
            "Website or application URL (if provided)"
          ]} />
        </LegalSubsection>

        <LegalSubsection title="API Usage Data">
          <p>When you use the Service, we automatically collect:</p>
          <LegalList items={[
            "API requests made (endpoints called, parameters used)",
            "Request timestamps and frequency",
            "IP addresses from which requests originate",
            "API key identifiers",
            "Response status codes and latency",
            "User-agent strings and client identifiers"
          ]} />
        </LegalSubsection>

        <LegalSubsection title="Technical Information">
          <p>We may also collect:</p>
          <LegalList items={[
            "Error logs and debugging information",
            "Rate limit events and quota usage",
            "Browser and device information when accessing documentation or dashboards"
          ]} />
        </LegalSubsection>
      </LegalSection>

      <LegalSection number="2" title="How We Use Your Information">
        <p>We use the information we collect for the following purposes:</p>
        
        <LegalSubsection title="Account Management">
          <LegalList items={[
            "To create and manage your API account",
            "To authenticate API requests",
            "To communicate with you about your account, including service updates and support",
            "To process payments and manage your subscription (if applicable)"
          ]} />
        </LegalSubsection>

        <LegalSubsection title="Service Operation">
          <LegalList items={[
            "To provide, maintain, and improve the Service",
            "To monitor system performance and reliability",
            "To diagnose technical issues and errors",
            "To enforce usage limits and quotas"
          ]} />
        </LegalSubsection>

        <LegalSubsection title="Abuse Prevention">
          <LegalList items={[
            "To detect and prevent unauthorized access, scraping, or abuse",
            "To identify patterns indicating Terms of Service violations",
            "To protect the integrity and security of our data and systems",
            "To investigate and respond to suspicious activity"
          ]} />
        </LegalSubsection>

        <LegalSubsection title="Service Improvement">
          <LegalList items={[
            "To analyze usage patterns and optimize API performance",
            "To identify popular endpoints and improve data coverage",
            "To develop new features and capabilities",
            "To create aggregate, anonymized statistics about Service usage"
          ]} />
        </LegalSubsection>
      </LegalSection>

      <LegalSection number="3" title="Data Storage & Retention">
        <LegalSubsection title="Where We Store Data">
          <p>
            Your data is stored on secure servers located in the United States. We use 
            industry-standard cloud infrastructure providers with appropriate security 
            certifications.
          </p>
        </LegalSubsection>

        <LegalSubsection title="How Long We Keep Data">
          <LegalList items={[
            "Account information: Retained for the duration of your account, plus 12 months after termination",
            "API usage logs: Retained for 90 days in detailed form, then aggregated",
            "Aggregated analytics: May be retained indefinitely in anonymized form",
            "Security and abuse logs: Retained for up to 24 months"
          ]} />
        </LegalSubsection>

        <LegalSubsection title="Data Backup">
          <p>
            We maintain regular backups to ensure data integrity and business continuity. 
            Backups are encrypted and subject to the same security controls as primary data.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection number="4" title="Data Sharing">
        <LegalSubsection title="We Do Not Sell Your Data">
          <p>
            We do not sell, rent, or trade your personal information to third parties 
            for marketing purposes. Your data is not used for advertising or shared 
            with data brokers.
          </p>
        </LegalSubsection>

        <LegalSubsection title="When We May Share Data">
          <p>We may share your information only in the following circumstances:</p>
          <LegalList items={[
            "With service providers who assist in operating our Service (hosting, payment processing) under strict confidentiality agreements",
            "If required by law, subpoena, court order, or government request",
            "To protect our rights, property, or safety, or that of our users or the public",
            "In connection with a merger, acquisition, or sale of assets (with notice to affected users)",
            "With your explicit consent"
          ]} />
        </LegalSubsection>

        <LegalSubsection title="Aggregated Data">
          <p>
            We may share aggregated, anonymized data that cannot reasonably be used to 
            identify you. For example, we may publish statistics about API usage patterns 
            or popular vehicle models.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection number="5" title="Data Security">
        <p>
          We implement appropriate technical and organizational measures to protect your 
          information against unauthorized access, alteration, disclosure, or destruction:
        </p>
        <LegalList items={[
          "API keys are transmitted over encrypted connections (HTTPS/TLS)",
          "Sensitive data is encrypted at rest using industry-standard algorithms",
          "Access to user data is restricted to authorized personnel only",
          "We conduct regular security reviews and vulnerability assessments",
          "API access includes rate limiting and abuse detection systems",
          "We maintain incident response procedures for security events"
        ]} />
        <p className="mt-4">
          While we strive to protect your information, no method of transmission or storage 
          is 100% secure. You are responsible for maintaining the confidentiality of your 
          API key.
        </p>
      </LegalSection>

      <LegalSection number="6" title="Your Rights">
        <p>Depending on your location, you may have certain rights regarding your personal data:</p>
        
        <LegalSubsection title="Access">
          <p>
            You can request a copy of the personal information we hold about you. We will 
            provide this information in a commonly used electronic format.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Correction">
          <p>
            You can request that we correct inaccurate or incomplete personal information. 
            You may update your account information directly or contact us for assistance.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Deletion">
          <p>
            You can request deletion of your account and personal information. Note that:
          </p>
          <LegalList items={[
            "Some data may be retained as required by law or for legitimate business purposes",
            "Aggregated, anonymized data that cannot identify you may be retained",
            "Deletion requests will be processed within 30 days"
          ]} />
        </LegalSubsection>

        <LegalSubsection title="Data Portability">
          <p>
            You can request your data in a structured, machine-readable format for transfer 
            to another service.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Objection">
          <p>
            You can object to certain processing of your personal data. We will consider 
            your request and respond within 30 days.
          </p>
        </LegalSubsection>

        <p className="mt-4">
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:privacy@warehousetiredirect.com" className="text-blue-400 hover:text-blue-300">
            privacy@warehousetiredirect.com
          </a>
        </p>
      </LegalSection>

      <LegalSection number="7" title="Cookies & Tracking">
        <p>
          The API itself does not use cookies. However, if you access our documentation, 
          dashboard, or website, we may use:
        </p>
        <LegalList items={[
          "Essential cookies required for site functionality",
          "Analytics cookies to understand how our documentation is used",
          "Session cookies to maintain your login state"
        ]} />
        <p className="mt-4">
          You can control cookie settings through your browser. Disabling cookies may 
          affect some features of our website but will not affect API functionality.
        </p>
      </LegalSection>

      <LegalSection number="8" title="Third-Party Services">
        <p>
          Our Service may integrate with or link to third-party services. We are not 
          responsible for the privacy practices of these third parties. We encourage 
          you to review their privacy policies.
        </p>
        <p className="mt-4">
          Third parties we may use include:
        </p>
        <LegalList items={[
          "Cloud hosting providers (for infrastructure)",
          "Payment processors (for subscription billing)",
          "Analytics services (for usage insights)",
          "Email services (for communications)"
        ]} />
      </LegalSection>

      <LegalSection number="9" title="International Data Transfers">
        <p>
          Your information may be transferred to and processed in countries other than 
          your own. We ensure appropriate safeguards are in place for such transfers, 
          including standard contractual clauses where required.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Children's Privacy">
        <p>
          The Service is not directed at individuals under the age of 18. We do not 
          knowingly collect personal information from children. If we become aware 
          that we have collected personal information from a child, we will take 
          steps to delete it.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of 
          material changes by:
        </p>
        <LegalList items={[
          "Posting the updated policy on this page with a new \"Last Updated\" date",
          "Sending notice to your registered email address",
          "Displaying a notice when you access the Service"
        ]} />
        <p className="mt-4">
          Your continued use of the Service after changes become effective constitutes 
          acceptance of the revised policy.
        </p>
      </LegalSection>

      <div className="mt-12 pt-8 border-t border-zinc-800">
        <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
        <p className="text-zinc-300 mb-4">
          If you have questions about this Privacy Policy or our data practices, please contact us:
        </p>
        <div className="text-zinc-300 space-y-2">
          <p>
            <strong className="text-white">Email:</strong>{' '}
            <a href="mailto:privacy@warehousetiredirect.com" className="text-blue-400 hover:text-blue-300">
              privacy@warehousetiredirect.com
            </a>
          </p>
          <p>
            <strong className="text-white">API Support:</strong>{' '}
            <a href="mailto:api@warehousetiredirect.com" className="text-blue-400 hover:text-blue-300">
              api@warehousetiredirect.com
            </a>
          </p>
        </div>
      </div>
    </LegalPageLayout>
  );
}
