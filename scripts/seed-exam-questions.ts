#!/usr/bin/env ts-node

/**
 * Seed Exam Questions
 * 
 * Creates exam questions for partner certification at all levels
 * Categories: Networking, Security, Hardware, Software, Troubleshooting
 */

import { PrismaClient, ExamLevel } from '@prisma/client';

const prisma = new PrismaClient();

const questions: Array<{
    level: ExamLevel;
    category: string;
    difficulty: number;
    question: string;
    options: any;
    correctAnswer: number;
    explanation: string;
}> = [
        // ============================================
        // BRONZE LEVEL QUESTIONS (Entry Level)
        // ============================================
        {
            level: 'BRONZE',
            category: 'Networking',
            difficulty: 1,
            question: 'What does IP stand for in networking?',
            options: ['Internet Protocol', 'Internal Process', 'Input Port', 'Integrated Pathway'],
            correctAnswer: 0,
            explanation: 'IP stands for Internet Protocol, which is the primary protocol for addressing and routing packets across networks.',
        },
        {
            level: 'BRONZE',
            category: 'Networking',
            difficulty: 1,
            question: 'Which port does HTTP typically use?',
            options: ['21', '80', '443', '3389'],
            correctAnswer: 1,
            explanation: 'HTTP (Hypertext Transfer Protocol) typically uses port 80 for unencrypted web traffic.',
        },
        {
            level: 'BRONZE',
            category: 'Networking',
            difficulty: 2,
            question: 'What is the purpose of a subnet mask?',
            options: [
                'To encrypt network traffic',
                'To divide an IP address into network and host portions',
                'To block malicious traffic',
                'To speed up internet connection',
            ],
            correctAnswer: 1,
            explanation: 'A subnet mask is used to divide an IP address into network and host portions, enabling network segmentation.',
        },
        {
            level: 'BRONZE',
            category: 'Security',
            difficulty: 1,
            question: 'What does HTTPS provide that HTTP does not?',
            options: ['Faster speed', 'Encryption', 'Better images', 'More storage'],
            correctAnswer: 1,
            explanation: 'HTTPS provides encryption using SSL/TLS, securing data transmitted between client and server.',
        },
        {
            level: 'BRONZE',
            category: 'Security',
            difficulty: 2,
            question: 'What is the primary purpose of a firewall?',
            options: [
                'To speed up network traffic',
                'To monitor and control network traffic based on rules',
                'To provide Wi-Fi',
                'To store files',
            ],
            correctAnswer: 1,
            explanation: 'A firewall monitors and controls incoming and outgoing network traffic based on predetermined security rules.',
        },
        {
            level: 'BRONZE',
            category: 'Hardware',
            difficulty: 1,
            question: 'What does RAM stand for?',
            options: [
                'Random Access Memory',
                'Read Access Module',
                'Rapid Action Memory',
                'Remote Access Mail',
            ],
            correctAnswer: 0,
            explanation: 'RAM stands for Random Access Memory, which is the temporary storage that computers use to hold data actively being used.',
        },
        {
            level: 'BRONZE',
            category: 'Hardware',
            difficulty: 2,
            question: 'What is the difference between SSD and HDD?',
            options: [
                'SSD uses flash memory, HDD uses spinning disks',
                'SSD is slower than HDD',
                'HDD is more expensive',
                'There is no difference',
            ],
            correctAnswer: 0,
            explanation: 'SSDs use flash memory (no moving parts), while HDDs use spinning magnetic disks. SSDs are faster but typically more expensive per GB.',
        },
        {
            level: 'BRONZE',
            category: 'Software',
            difficulty: 1,
            question: 'What is an operating system?',
            options: [
                'A type of hardware',
                'System software that manages computer hardware and software',
                'An antivirus program',
                'A web browser',
            ],
            correctAnswer: 1,
            explanation: 'An operating system is system software that manages hardware and software resources and provides common services.',
        },
        {
            level: 'BRONZE',
            category: 'Troubleshooting',
            difficulty: 2,
            question: 'A user cannot connect to Wi-Fi. What is the FIRST step you should take?',
            options: [
                'Reinstall Windows',
                'Replace the network card',
                'Check if Wi-Fi is enabled and correct password is entered',
                'Contact the ISP',
            ],
            correctAnswer: 2,
            explanation: 'Always start with the simplest solutions first. Checking if Wi-Fi is enabled and the password is correct are basic first steps.',
        },
        {
            level: 'BRONZE',
            category: 'Troubleshooting',
            difficulty: 2,
            question: 'What command can you use to test network connectivity to a remote host?',
            options: ['format', 'ping', 'delete', 'install'],
            correctAnswer: 1,
            explanation: 'The ping command sends ICMP echo requests to test network connectivity and measure round-trip time.',
        },

        // ============================================
        // SILVER LEVEL QUESTIONS (Intermediate)
        // ============================================
        {
            level: 'SILVER',
            category: 'Networking',
            difficulty: 3,
            question: 'What is the purpose of DHCP?',
            options: [
                'To encrypt emails',
                'To automatically assign IP addresses to devices',
                'To block malware',
                'To compress files',
            ],
            correctAnswer: 1,
            explanation: 'DHCP (Dynamic Host Configuration Protocol) automatically assigns IP addresses and network configuration to devices.',
        },
        {
            level: 'SILVER',
            category: 'Networking',
            difficulty: 3,
            question: 'Which of the following is a private IP address range?',
            options: ['8.8.8.8', '192.168.1.1', '1.1.1.1', '208.67.222.222'],
            correctAnswer: 1,
            explanation: '192.168.x.x is a private IP address range (RFC 1918), not routable on the public internet.',
        },
        {
            level: 'SILVER',
            category: 'Networking',
            difficulty: 4,
            question: 'What is the difference between a router and a switch?',
            options: [
                'No difference',
                'Router connects networks, switch connects devices within a network',
                'Switch is wireless, router is wired',
                'Router is faster',
            ],
            correctAnswer: 1,
            explanation: 'A router connects different networks and routes traffic between them, while a switch connects devices within the same network.',
        },
        {
            level: 'SILVER',
            category: 'Security',
            difficulty: 3,
            question: 'What is two-factor authentication (2FA)?',
            options: [
                'Using two passwords',
                'Authentication requiring two different types of credentials',
                'Logging in twice',
                'Having two user accounts',
            ],
            correctAnswer: 1,
            explanation: '2FA requires two different authentication factors (e.g., password + SMS code, password + fingerprint).',
        },
        {
            level: 'SILVER',
            category: 'Security',
            difficulty: 4,
            question: 'What is a VPN primarily used for?',
            options: [
                'To increase internet speed',
                'To create a secure encrypted connection over a less secure network',
                'To download files faster',
                'To block ads',
            ],
            correctAnswer: 1,
            explanation: 'A VPN (Virtual Private Network) creates an encrypted tunnel over a public network, securing data transmission.',
        },
        {
            level: 'SILVER',
            category: 'Hardware',
            difficulty: 3,
            question: 'What is the purpose of a UPS (Uninterruptible Power Supply)?',
            options: [
                'To speed up computers',
                'To provide backup power during outages',
                'To connect to the internet',
                'To cool down servers',
            ],
            correctAnswer: 1,
            explanation: 'A UPS provides emergency power to devices when the main power source fails, preventing data loss and hardware damage.',
        },
        {
            level: 'SILVER',
            category: 'Software',
            difficulty: 3,
            question: 'What is the difference between SaaS and on-premise software?',
            options: [
                'No difference',
                'SaaS is cloud-hosted, on-premise is installed locally',
                'SaaS is always free',
                'On-premise is always better',
            ],
            correctAnswer: 1,
            explanation: 'SaaS (Software as a Service) is hosted in the cloud by the provider, while on-premise software is installed and run on local infrastructure.',
        },
        {
            level: 'SILVER',
            category: 'Troubleshooting',
            difficulty: 4,
            question: 'A server is running slowly. What should you check FIRST?',
            options: [
                'Replace the server',
                'Check resource usage (CPU, RAM, Disk)',
                'Reinstall the OS',
                'Buy more software licenses',
            ],
            correctAnswer: 1,
            explanation: 'Always check resource usage first to identify bottlenecks (CPU, RAM, disk I/O) before making changes.',
        },

        // ============================================
        // GOLD LEVEL QUESTIONS (Advanced)
        // ============================================
        {
            level: 'GOLD',
            category: 'Networking',
            difficulty: 4,
            question: 'What is the purpose of VLAN (Virtual LAN)?',
            options: [
                'To increase internet speed',
                'To logically segment a network into broadcast domains',
                'To connect to Wi-Fi',
                'To encrypt data',
            ],
            correctAnswer: 1,
            explanation: 'VLANs allow network administrators to logically segment a physical network into multiple broadcast domains for security and performance.',
        },
        {
            level: 'GOLD',
            category: 'Networking',
            difficulty: 5,
            question: 'In the OSI model, which layer is responsible for routing?',
            options: ['Layer 1 (Physical)', 'Layer 2 (Data Link)', 'Layer 3 (Network)', 'Layer 7 (Application)'],
            correctAnswer: 2,
            explanation: 'The Network layer (Layer 3) is responsible for routing packets between networks using IP addresses.',
        },
        {
            level: 'GOLD',
            category: 'Security',
            difficulty: 4,
            question: 'What is the principle of least privilege?',
            options: [
                'Give everyone admin access',
                'Grant only the minimum access necessary for users to perform their job',
                'Deny all access by default',
                'Use the same password for everything',
            ],
            correctAnswer: 1,
            explanation: 'The principle of least privilege states that users should have only the minimum access rights necessary to perform their job functions.',
        },
        {
            level: 'GOLD',
            category: 'Security',
            difficulty: 5,
            question: 'What type of attack involves intercepting communication between two parties?',
            options: ['DDoS', 'Phishing', 'Man-in-the-middle', 'SQL Injection'],
            correctAnswer: 2,
            explanation: 'A man-in-the-middle (MITM) attack intercepts communication between two parties to eavesdrop or alter the data.',
        },
        {
            level: 'GOLD',
            category: 'Hardware',
            difficulty: 4,
            question: 'What is RAID and what is its primary purpose?',
            options: [
                'A type of CPU',
                'A data storage technology combining multiple disks for redundancy/performance',
                'A network protocol',
                'An antivirus software',
            ],
            correctAnswer: 1,
            explanation: 'RAID (Redundant Array of Independent Disks) combines multiple physical hard drives for data redundancy and/or performance improvement.',
        },

        // ============================================
        // PLATINUM LEVEL QUESTIONS (Expert)
        // ============================================
        {
            level: 'PLATINUM',
            category: 'Networking',
            difficulty: 5,
            question: 'What is BGP and why is it important for the internet?',
            options: [
                'A firewall protocol',
                'Border Gateway Protocol - the routing protocol of the internet',
                'A security certificate',
                'A wireless standard',
            ],
            correctAnswer: 1,
            explanation: 'BGP (Border Gateway Protocol) is the protocol that makes routing decisions on the internet, enabling different autonomous systems to exchange routing information.',
        },
        {
            level: 'PLATINUM',
            category: 'Security',
            difficulty: 5,
            question: 'What is a zero-day vulnerability?',
            options: [
                'A bug that takes zero days to fix',
                'A security flaw unknown to the vendor and has no patch available',
                'A vulnerability that expires in zero days',
                'A feature that was never released',
            ],
            correctAnswer: 1,
            explanation: 'A zero-day vulnerability is a security flaw that is unknown to the software vendor and therefore has no patch or fix available.',
        },
        {
            level: 'PLATINUM',
            category: 'Troubleshooting',
            difficulty: 5,
            question: 'A company experiences intermittent network issues. What systematic approach would you take?',
            options: [
                'Restart all servers immediately',
                'Use the OSI model to isolate the problem layer-by-layer',
                'Blame the ISP',
                'Wait for it to resolve itself',
            ],
            correctAnswer: 1,
            explanation: 'Using the OSI model provides a systematic approach to troubleshooting, starting from physical layer and working up through each layer.',
        },
    ];

async function main() {
    console.log('🌱 Seeding exam questions...\n');

    try {
        // Delete existing questions
        const deleteCount = await prisma.examQuestion.deleteMany({});
        console.log(`🗑️  Deleted ${deleteCount.count} existing questions\n`);

        // Create questions
        let created = 0;
        for (const q of questions) {
            await prisma.examQuestion.create({
                data: q,
            });
            created++;
        }

        console.log(`✅ Created ${created} exam questions\n`);

        // Show breakdown by level
        const levels = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
        console.log('📊 Breakdown by level:');
        for (const level of levels) {
            const count = questions.filter((q) => q.level === level).length;
            console.log(`   ${level}: ${count} questions`);
        }

        console.log('\n✨ Exam question seeding complete!\n');
    } catch (error: unknown) {
        console.error('❌ Error seeding questions:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();
