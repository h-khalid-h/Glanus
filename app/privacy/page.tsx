import Link from 'next/link';

export const metadata = {
    title: 'Privacy Policy | Glanus',
    description: 'Glanus platform privacy policy and data handling practices.',
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-15" />

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
                <Link href="/" className="text-nerve hover:text-nerve/80 text-sm transition-colors mb-8 inline-block">
                    ← Back to Home
                </Link>

                <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
                <p className="text-muted-foreground text-sm mb-10">Last updated: February 2026</p>

                <div className="space-y-8 text-foreground leading-relaxed">
                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
                        <p className="mb-3">We collect the following categories of information:</p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            <li><strong className="text-foreground">Account Information</strong> — Name, email address, password (hashed), and role within workspaces.</li>
                            <li><strong className="text-foreground">Asset Data</strong> — IT asset details, configurations, and metadata you submit to the platform.</li>
                            <li><strong className="text-foreground">Usage Data</strong> — Login timestamps, IP addresses, user agent strings, and feature usage patterns.</li>
                            <li><strong className="text-foreground">Agent Data</strong> — System metrics, heartbeat data, and command execution results from deployed agents.</li>
                            <li><strong className="text-foreground">Payment Information</strong> — Processed securely via Stripe; we do not store card numbers directly.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            <li>Providing, maintaining, and improving the Glanus platform.</li>
                            <li>Processing transactions and managing your subscription.</li>
                            <li>Sending transactional emails (invitations, alerts, password resets).</li>
                            <li>Monitoring security events and preventing unauthorized access.</li>
                            <li>Generating aggregated analytics (no personally identifiable data shared).</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">3. Data Storage &amp; Security</h2>
                        <p>
                            Your data is stored in secure PostgreSQL databases with encrypted connections.
                            Passwords are hashed using bcrypt with salt rounds. API keys are stored as SHA-256
                            hashes — we never store plaintext keys. All data transmission is encrypted via TLS/HTTPS.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">4. Multi-Tenant Isolation</h2>
                        <p>
                            Glanus is a multi-tenant platform. Each workspace is logically isolated — data belonging
                            to one workspace is never accessible from another. Access within a workspace is controlled
                            by role-based permissions (Owner, Admin, Member, Viewer).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Sharing</h2>
                        <p className="mb-2">We do not sell your personal data. We may share data with:</p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            <li><strong className="text-foreground">Service Providers</strong> — Stripe (payments), SendGrid (email), Sentry (error tracking).</li>
                            <li><strong className="text-foreground">Partners</strong> — Certified partners assigned to your workspace may access relevant workspace data to deliver services.</li>
                            <li><strong className="text-foreground">Legal Requirements</strong> — When required by law, court order, or to protect safety.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Retention</h2>
                        <p>
                            Account data is retained while your account is active. Upon account deletion, personal
                            data is purged within 30 days. Audit logs are retained for 90 days for security
                            compliance. Anonymized analytics data may be retained indefinitely.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">7. Your Rights (GDPR)</h2>
                        <p className="mb-2">Under the General Data Protection Regulation, you have the right to:</p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            <li><strong className="text-foreground">Access</strong> — Request a copy of your personal data.</li>
                            <li><strong className="text-foreground">Rectification</strong> — Request correction of inaccurate data.</li>
                            <li><strong className="text-foreground">Erasure</strong> — Request deletion of your personal data.</li>
                            <li><strong className="text-foreground">Portability</strong> — Request your data in a structured, machine-readable format.</li>
                            <li><strong className="text-foreground">Restriction</strong> — Request restriction of processing in certain circumstances.</li>
                            <li><strong className="text-foreground">Objection</strong> — Object to processing based on legitimate interests.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">8. Cookies</h2>
                        <p>
                            We use essential cookies for authentication sessions (NextAuth.js session tokens) and
                            CSRF protection. These are strictly necessary for the Service to function and cannot
                            be disabled. We do not use tracking or advertising cookies.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">9. Children&apos;s Privacy</h2>
                        <p>
                            The Service is not directed to individuals under the age of 16. We do not knowingly
                            collect personal information from children.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy periodically. Material changes will be communicated
                            via email or a prominent notice within the Service. Your continued use constitutes
                            acceptance of the updated policy.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">11. Contact</h2>
                        <p>
                            For privacy-related inquiries, data access requests, or to exercise your GDPR rights,
                            contact us at{' '}
                            <a href="mailto:privacy@glanus.com" className="text-nerve hover:text-nerve/80 transition-colors">
                                privacy@glanus.com
                            </a>.
                        </p>
                    </section>

                    <div className="border-t border-border pt-8 mt-12">
                        <p className="text-sm text-muted-foreground">
                            See also: <Link href="/terms" className="text-nerve hover:text-nerve/80 transition-colors">Terms of Service</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
