// File: frontend/src/pages/PrivacyPolicyPage.tsx

import React from 'react';

export function PrivacyPolicyPage() {
    return (
        <div className="bg-[#111115] min-h-screen font-sans text-[#F5F5F7] py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-[#007BFF] to-[#E600FF] bg-clip-text text-transparent">Privacy Policy</h1>
                    <p className="mt-2 text-sm text-gray-400">Last Updated: September 3, 2025</p>
                </div>

                <div className="space-y-6 text-gray-300 prose prose-invert max-w-none">
                    <p>AI Plexus, LLC ("we," "us," or "our") operates the Vyralize AI application (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.</p>

                    <h2>1. Information We Collect</h2>
                    <p>We collect several different types of information for various purposes to provide and improve our Service to you.</p>
                    <ul>
                        <li><strong>Personal Data:</strong> While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you. This includes your email address, which is collected and managed through our authentication provider, Clerk.</li>
                        <li><strong>Payment Data:</strong> When you purchase credits, your payment information is processed by our third-party payment processor, Stripe. We do not store your full credit card information on our servers.</li>
                        <li><strong>Input Content:</strong> We collect the content you upload to the Service, such as YouTube links, text topics, and images, in order to provide the core functionality of the Service.</li>
                        <li><strong>Usage Data:</strong> We may collect information on how the Service is accessed and used. This may include information such as your computer's IP address, browser type, and other diagnostic data.</li>
                    </ul>

                    <h2>2. How We Use Your Information</h2>
                    <p>We use the collected data for various purposes:</p>
                    <ul>
                        <li>To provide, maintain, and operate our Service.</li>
                        <li>To manage your account and process your transactions.</li>
                        <li>To notify you about changes to our Service.</li>
                        <li>To provide customer support.</li>
                        <li>To monitor the usage of our Service and improve its functionality.</li>
                    </ul>

                    <h2>3. How We Share Your Information</h2>
                    <p>We do not sell your personal data. We may share your information with third-party service providers to facilitate our Service, to provide the Service on our behalf, or to assist us in analyzing how our Service is used. These third parties have access to your Personal Data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.</p>
                    <ul>
                        <li><strong>Clerk:</strong> For user authentication and account management.</li>
                        <li><strong>Supabase:</strong> For our database and backend infrastructure.</li>
                        <li><strong>Google (Imagen):</strong> The content you provide for generation is processed by Google's AI models to provide the Service's core features.</li>
                        <li><strong>Stripe:</strong> For secure payment processing.</li>
                    </ul>
                    
                    <h2>4. Data Security</h2>
                    <p>The security of your data is important to us, but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.</p>

                    <h2>5. Changes to This Privacy Policy</h2>
                    <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.</p>

                    <h2>6. Contact Us</h2>
                    <p>If you have any questions about this Privacy Policy, please contact us at: contact@aiplexus.io</p>
                </div>
                 <div className="text-center mt-12">
                    <a href="/" className="px-6 py-2 bg-gradient-to-r from-[#007BFF] to-[#E600FF] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity no-underline">
                        Back to App
                    </a>
                </div>
            </div>
        </div>
    );
}