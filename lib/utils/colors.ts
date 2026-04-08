/**
 * Utility functions for colors.
 */

/**
 * Converts a hex color string (e.g., "#00E5C8") to a Tailwind-compatible
 * space-separated HSL string (e.g., "168 100% 45%").
 */
export function hexToTailwindHsl(hex: string): string | null {
    if (!hex) return null;
    
    // Remove the hash if it exists
    let cleanHex = hex.replace('#', '');
    
    // Expand shorthand form (e.g. "03F" -> "0033FF")
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(char => char + char).join('');
    }
    
    if (cleanHex.length !== 6) return null;
    
    // Parse hexadecimal components
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        return null;
    }
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    // Convert to percentages and degrees
    const hDeg = Math.round(h * 360);
    const sPct = Math.round(s * 100);
    const lPct = Math.round(l * 100);
    
    return `${hDeg} ${sPct}% ${lPct}%`;
}
