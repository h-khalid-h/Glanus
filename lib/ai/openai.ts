import OpenAI from 'openai';

let openaiInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not defined in environment variables');
  }

  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiInstance;
}

export const defaultModel = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

// Prompt templates for different AI features
export const prompts = {
  assetCategorization: (description: string) => `
    Analyze this IT asset description and provide:
    1. The most appropriate category (Computer, Laptop, Monitor, Server, Network Equipment, Mobile Device, Printer, Other)
    2. Up to 5 relevant tags
    3. A normalized, professional asset name
    
    Asset description: "${description}"
    
    Respond in JSON format:
    {
      "category": "category_name",
      "tags": ["tag1", "tag2", ...],
      "suggestedName": "normalized name"
    }
  `,

  healthPrediction: (assetData: Record<string, unknown>) => `
    Based on this IT asset data, predict potential issues and maintenance needs:
    
    Asset: ${assetData.name}
    Category: ${assetData.category}
    Age: ${assetData.ageInMonths} months
    Usage history: ${JSON.stringify(assetData.usageHistory)}
    
    Provide:
    1. Health score (0-100)
    2. Predicted issues in the next 3-6 months
    3. Recommended maintenance actions
    4. Estimated remaining useful life
    
    Respond in JSON format.
  `,

  anomalyDetection: (sessionData: unknown[]) => `
    Analyze these remote access sessions for anomalies or security concerns:
    
    ${JSON.stringify(sessionData, null, 2)}
    
    Identify:
    1. Unusual access patterns
    2. Potential security risks
    3. Recommendations for security improvements
    
    Respond in JSON format with severity levels (low, medium, high, critical).
  `,

  supportAssistant: (context: string, userMessage: string) => `
    You are an IT support assistant for Glanus, an IT operations platform.
    
    Context: ${context}
    User question: ${userMessage}
    
    Provide a helpful, concise response with actionable steps if applicable.
    If the issue requires escalation, clearly indicate that.
  `,

  lifecycleRecommendations: (assetPortfolio: unknown) => `
    Analyze this IT asset portfolio and provide strategic recommendations:
    
    ${JSON.stringify(assetPortfolio, null, 2)}
    
    Provide:
    1. Assets due for replacement in next 6 months
    2. Budget forecast for next 12 months
    3. Cost optimization opportunities
    4. Vendor consolidation opportunities
    
    Respond in JSON format.
  `,
};
