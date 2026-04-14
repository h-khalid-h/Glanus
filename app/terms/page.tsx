import Link from 'next/link';

export const metadata = {
    title: 'Terms of Service | Glanus',
    description: 'Glanus platform terms of service and usage agreement.',
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-15" />

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
                <Link href="/" className="text-nerve hover:text-nerve/80 text-sm transition-colors mb-8 inline-block">
                    ← Back to Home
                </Link>

                <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
                <p className="text-muted-foreground text-sm mb-10">Last updated: February 2026</p>

                <div className="space-y-8 text-foreground leading-relaxed">
                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using the Glanus platform (&quot;Service&quot;), you agree to be bound by these Terms
                            of Service. If you do not agree to these terms, do not use the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
                        <p>
                            Glanus is a multi-tenant IT asset management platform providing asset tracking, monitoring,
                            analytics, remote management, and partner ecosystem management. The Service is available
                            under various subscription tiers with different feature sets and usage limits.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">3. User Accounts</h2>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            <li>You must provide accurate and complete registration information.</li>
                            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                            <li>You must notify us immediately of any unauthorized use of your account.</li>
                            <li>Each user account represents a single individual and may not be shared.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">4. Workspace &amp; Data Ownership</h2>
                        <p>
                            You retain all rights to the data you submit to the Service. Each workspace is isolated
                            and data is scoped to the workspace level. Workspace owners and administrators control
                            access and permissions within their workspace.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">5. Acceptable Use</h2>
                        <p className="mb-2">You agree not to:</p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                            <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
                            <li>Attempt to gain unauthorized access to any systems or networks connected to the Service.</li>
                            <li>Interfere with or disrupt the integrity or performance of the Service.</li>
                            <li>Use automated tools to scrape, crawl, or mine data from the Service.</li>
                            <li>Upload malicious code, viruses, or any other harmful content.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">6. Subscription &amp; Billing</h2>
                        <p>
                            Paid subscriptions are billed according to the plan selected. Subscription fees are
                            non-refundable except as required by law. We reserve the right to modify pricing with
                            30 days notice. Usage that exceeds your plan limits may result in service restrictions
                            or require an upgrade.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">7. Partner Program</h2>
                        <p>
                            Partners participating in the Glanus Partner Program are subject to additional terms
                            including revenue sharing arrangements (70/30 split), certification requirements,
                            and service level expectations. Partner accounts may be suspended for non-compliance.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">8. Intellectual Property</h2>
                        <p>
                            The Service, including its design, code, and branding, is owned by Glanus and protected by
                            intellectual property laws. You are granted a limited, non-exclusive license to use the
                            Service for its intended purpose during your subscription period.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">9. Limitation of Liability</h2>
                        <p>
                            To the maximum extent permitted by law, Glanus shall not be liable for any indirect,
                            incidental, special, consequential, or punitive damages, including loss of data, revenue,
                            or business opportunities, arising from your use of the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">10. Termination</h2>
                        <p>
                            Either party may terminate the agreement at any time. Upon termination, your access to
                            the Service will be revoked and your data may be deleted after a 30-day retention period.
                            You may export your data before termination.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">11. Changes to Terms</h2>
                        <p>
                            We may update these Terms from time to time. We will notify you of material changes
                            via email or through the Service. Continued use of the Service after changes constitutes
                            acceptance of the updated Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-foreground mb-3">12. Contact</h2>
                        <p>
                            For questions about these Terms, please contact us at{' '}
                            <a href="mailto:legal@glanus.com" className="text-nerve hover:text-nerve/80 transition-colors">
                                legal@glanus.com
                            </a>.
                        </p>
                    </section>

                    <div className="border-t border-border pt-8 mt-12">
                        <p className="text-sm text-muted-foreground">
                            See also: <Link href="/privacy" className="text-nerve hover:text-nerve/80 transition-colors">Privacy Policy</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
