import { Workspace, Partner, PartnerCertificationLevel } from '@prisma/client';

/**
 * Partner Assignment Algorithm
 * 
 * Finds the best-matching partner for a workspace based on:
 * - Geographic proximity (40 points)
 * - Industry expertise (25 points)
 * - Rating (20 points)
 * - Availability (10 points)
 * - Language match (5 points)
 */

interface WorkspaceWithLocation {
    id: string;
    city?: string;
    region?: string;
    country: string;
    // Add industry if you have it on workspace
}

interface PartnerWithDetails extends Partner {
    assignments: { id: string }[];
}

interface PartnerScore {
    partner: PartnerWithDetails;
    score: number;
    breakdown: {
        geographic: number;
        industry: number;
        rating: number;
        availability: number;
        language: number;
    };
}

// Simple distance calculation (haversine formula for lat/lng would be better in production)
function calculateCityDistance(
    city1?: string,
    region1?: string,
    city2?: string,
    region2?: string
): number {
    // Simple heuristic: same city = 0, same region = 50, different region = 100+
    if (city1 && city2 && city1.toLowerCase() === city2.toLowerCase()) {
        return 0;
    }
    if (region1 && region2 && region1.toLowerCase() === region2.toLowerCase()) {
        return 50; // miles
    }
    return 150; // miles - different region
}

export async function findBestPartner(
    workspace: WorkspaceWithLocation,
    eligiblePartners: PartnerWithDetails[]
): Promise<PartnerScore | null> {
    if (eligiblePartners.length === 0) {
        return null;
    }

    const scored: PartnerScore[] = eligiblePartners.map((partner) => {
        const breakdown = {
            geographic: 0,
            industry: 0,
            rating: 0,
            availability: 0,
            language: 0,
        };

        // 1. Geographic proximity (40 points max)
        if (workspace.city && partner.city) {
            const distance = calculateCityDistance(
                workspace.city,
                workspace.region,
                partner.city,
                partner.region ?? undefined
            );

            if (partner.serviceRadius && distance <= partner.serviceRadius) {
                // Score based on how close within service radius
                breakdown.geographic = 40 * (1 - distance / partner.serviceRadius);
            } else if (partner.remoteOnly) {
                // Remote-only partners get partial credit
                breakdown.geographic = 20;
            }
        } else if (partner.remoteOnly) {
            // Remote partner, no location data needed
            breakdown.geographic = 25;
        }

        // 2. Industry expertise (25 points max)
        // This would require workspace.industry field - placeholder for now
        if (partner.industries) {
            const industries = partner.industries as string[];
            // If workspace has matching industry, give full points
            // For now, give some points if partner has ANY industries listed
            if (industries.length > 0) {
                breakdown.industry = 15; // Partial credit
            }
        }

        // 3. Rating (20 points max)
        if (partner.averageRating) {
            // Convert 0-5 star rating to 0-20 points
            breakdown.rating = (Number(partner.averageRating) / 5) * 20;
        } else {
            // No rating yet (new partner) - give neutral score
            breakdown.rating = 10;
        }

        // 4. Availability (10 points max)
        const utilizationRate = 1 - partner.availableSlots / partner.maxWorkspaces;
        // Prefer partners with more available capacity
        breakdown.availability = (1 - utilizationRate) * 10;

        // 5. Language match (5 points max)
        // Default to English match for now
        if (partner.languages.includes('en')) {
            breakdown.language = 5;
        }

        const totalScore =
            breakdown.geographic +
            breakdown.industry +
            breakdown.rating +
            breakdown.availability +
            breakdown.language;

        return {
            partner,
            score: totalScore,
            breakdown,
        };
    });

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Return best match (if score > threshold of 30)
    const best = scored[0];
    return best && best.score > 30 ? best : null;
}

// Get partners eligible for assignment
export function getPartnerEligibilityCriteria() {
    return {
        status: 'ACTIVE' as const,
        acceptingNew: true,
        availableSlots: { gt: 0 },
    };
}

// Calculate max workspaces by certification level
export function getMaxWorkspacesByLevel(level: PartnerCertificationLevel): number {
    const limits = {
        BRONZE: 10,
        SILVER: 50,
        GOLD: 200,
        PLATINUM: 1000,
    };
    return limits[level];
}
