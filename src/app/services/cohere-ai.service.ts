// services/cohere-ai.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export interface SiteContext {
  selectedSite: { lat: number; lng: number };
  nearestMaterials: Array<{
    material: any;
    distance: number;
    travelTime: number;
  }>;
  restrictions: string[];
  analysisResult: any;
}

export interface AIRecommendation {
  summary: string;
  recommendation: string;
  alternativeLocation?: {
    lat: number;
    lng: number;
    reason: string;
    distance: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  keyFactors: string[];
  nextSteps: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CohereAIService {
  private http = inject(HttpClient);
  
  private readonly API_KEY = 'zU0IsKLMQLR2Lx333Bt00hLPj5ng4EY48TI0DIYm';
  private readonly API_URL = 'https://api.cohere.ai/v2/chat'; // V2 API endpoint

  async generateRecommendations(context: SiteContext): Promise<AIRecommendation> {
    try {
      const requestBody = this.buildChatRequest(context);
      
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      });

      console.log('🤖 Sending request to Cohere V2 API...');
      console.log('Request Body:', JSON.stringify(requestBody, null, 2));
      
      const response: any = await this.http.post(this.API_URL, requestBody, { headers })
        .pipe(
          catchError((error: HttpErrorResponse) => {
            console.error('❌ Cohere V2 API Error Status:', error.status);
            console.error('❌ Cohere V2 API Error Message:', error.message);
            console.error('❌ Cohere V2 API Error Details:', error.error);
            
            if (error.status === 401) {
              throw new Error('Invalid API key. Please check your Cohere API key.');
            } else if (error.status === 400) {
              throw new Error(`Bad Request: ${error.error?.message || 'Invalid request format'}`);
            } else if (error.status === 429) {
              throw new Error('API rate limit exceeded. Please try again later.');
            } else {
              throw new Error(`Cohere API error: ${error.status} - ${error.message}`);
            }
          })
        )
        .toPromise();

      console.log('✅ Cohere V2 API Response:', response);
      
      if (response?.message?.content?.[0]?.text) {
        console.log('🤖 Raw AI response received');
        return this.parseAIResponse(response.message.content[0].text);
      } else if (response?.text) {
        console.log('🤖 Raw AI response received (legacy format)');
        return this.parseAIResponse(response.text);
      } else {
        console.log('Unexpected response structure:', response);
        throw new Error('Unexpected response format from Cohere AI');
      }
    } catch (error) {
      console.error('Cohere AI API error:', error);
      return this.ruleBasedFallback(context);
    }
  }

  private buildChatRequest(context: SiteContext): any {
    const { selectedSite, nearestMaterials, restrictions } = context;

    const systemMessage = `You are a construction site planning expert in Kenya. Analyze potential construction sites and provide specific, actionable recommendations focusing on Kenyan regulations, material accessibility, and environmental factors.

Always respond with valid JSON in this exact format:
{
  "summary": "Brief overall assessment of site suitability",
  "recommendation": "Specific actionable advice for this location",
  "alternativeLocation": {
    "lat": 12.3456,
    "lng": 34.5678,
    "reason": "Why this alternative location is better",
    "distance": 1500
  },
  "riskLevel": "low|medium|high",
  "confidence": 0.85,
  "keyFactors": ["factor1", "factor2", "factor3"],
  "nextSteps": ["step1", "step2", "step3"]
}

Focus on Kenyan context:
- NEMA regulations and environmental compliance
- Material accessibility and local supplier networks
- Environmental impact and sustainability
- Construction feasibility in East African conditions`;

    const userMessage = `
SITE CONTEXT:
📍 Location: ${selectedSite.lat.toFixed(4)}, ${selectedSite.lng.toFixed(4)}

🚫 RESTRICTIONS:
${restrictions.length > 0 ? restrictions.map(r => `• ${r}`).join('\n') : '• No major restrictions detected'}

🏗️ NEAREST MATERIAL SOURCES:
${nearestMaterials.slice(0, 5).map(m => 
  `• ${m.material.name} (${m.material.type.join(', ')}) - ${m.distance}m away (${m.travelTime} min travel)`
).join('\n')}

Please analyze this construction site and provide recommendations in the specified JSON format.`;

    return {
      model: 'command-a-03-2025', // New model from the example
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.3,
      max_tokens: 1200,
    };
  }

  private parseAIResponse(aiText: string): AIRecommendation {
    try {
      // Clean the response and extract JSON
      const cleanedText = aiText.replace(/```json\n?|\n?```/g, '').trim();
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateAIResponse(parsed);
      } else {
        // Fallback parsing for malformed JSON
        console.warn('Could not find JSON in response, attempting fallback parsing');
        return this.fallbackParse(cleanedText);
      }
    } catch (error) {
      console.error('Failed to parse Cohere AI response:', error);
      console.log('Raw response:', aiText);
      throw new Error('AI response parsing failed');
    }
  }

  private fallbackParse(text: string): AIRecommendation {
    const lines = text.split('\n');
    let summary = 'Site analysis completed';
    let recommendation = 'Consider professional assessment';
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes('summary') || lowerLine.includes('assess')) {
        summary = line.split(':').slice(1).join(':').trim() || summary;
      }
      if (lowerLine.includes('recommend') || lowerLine.includes('advice')) {
        recommendation = line.split(':').slice(1).join(':').trim() || recommendation;
      }
      if (lowerLine.includes('high risk')) riskLevel = 'high';
      if (lowerLine.includes('low risk')) riskLevel = 'low';
    }

    return {
      summary,
      recommendation,
      riskLevel,
      confidence: 0.7,
      keyFactors: ['Regulatory compliance', 'Material access', 'Environmental impact'],
      nextSteps: ['Conduct site visit', 'Review local regulations', 'Consult with authorities']
    };
  }

  private validateAIResponse(response: any): AIRecommendation {
    // Fix the typo in recommendation field
    const recommendation = response.recommendation || response.recomendation || 'Consider professional site assessment';
    
    return {
      summary: response.summary || 'AI analysis completed',
      recommendation: recommendation,
      alternativeLocation: response.alternativeLocation ? {
        lat: this.sanitizeCoordinate(response.alternativeLocation.lat, 'lat'),
        lng: this.sanitizeCoordinate(response.alternativeLocation.lng, 'lng'),
        reason: response.alternativeLocation.reason || 'Better location suggested by AI',
        distance: Math.min(10000, Math.max(100, response.alternativeLocation.distance || 1000))
      } : undefined,
      riskLevel: ['low', 'medium', 'high'].includes(response.riskLevel) ? response.riskLevel : 'medium',
      confidence: Math.min(1, Math.max(0, response.confidence || 0.7)),
      keyFactors: Array.isArray(response.keyFactors) ? response.keyFactors.slice(0, 3) : 
        ['Regulatory compliance', 'Material accessibility', 'Site suitability'],
      nextSteps: Array.isArray(response.nextSteps) ? response.nextSteps.slice(0, 3) : 
        ['Site assessment', 'Permit applications', 'Material planning']
    };
  }

  private sanitizeCoordinate(coord: number, type: 'lat' | 'lng'): number {
    if (type === 'lat') {
      return Math.max(-4.0, Math.min(4.0, coord || -1.2921));
    } else {
      return Math.max(33.0, Math.min(42.0, coord || 36.8219));
    }
  }

  private ruleBasedFallback(context: SiteContext): AIRecommendation {
    const { selectedSite, nearestMaterials, restrictions } = context;
    
    const hasProtectedArea = restrictions.some(r => r.includes('Protected Area') || r.includes('National Park'));
    const hasWaterBody = restrictions.some(r => r.includes('Water Body') || r.includes('Lake') || r.includes('River'));
    const hasAirport = restrictions.some(r => r.includes('Airport'));
    
    const closestMaterial = nearestMaterials[0];
    const hasCloseMaterials = closestMaterial && closestMaterial.distance < 5000;

    let recommendation = '';
    let alternativeLocation = undefined;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    if (hasProtectedArea) {
      recommendation = `Site within protected area boundary. Relocate at least 2km away to comply with Kenyan environmental regulations (NEMA).`;
      riskLevel = 'high';
      alternativeLocation = this.calculateAlternativeLocation(selectedSite, 2000, 'Away from protected area boundary');
    } else if (hasWaterBody) {
      recommendation = `Proximity to water body requires flood risk assessment and NEMA permits. Consider elevated site.`;
      riskLevel = 'medium';
      alternativeLocation = this.calculateAlternativeLocation(selectedSite, 500, 'Higher ground with better drainage');
    } else if (hasAirport) {
      recommendation = `Airport proximity may impose height restrictions and require KCAA clearance.`;
      riskLevel = 'medium';
    } else if (!hasCloseMaterials) {
      recommendation = `Limited material access may increase construction costs. Consider material import or alternative construction methods.`;
      riskLevel = 'medium';
    } else {
      recommendation = `Site appears suitable with good material access. Proceed with standard construction approval process.`;
      riskLevel = 'low';
    }

    return {
      summary: this.generateSummary(restrictions, hasCloseMaterials),
      recommendation,
      alternativeLocation,
      riskLevel,
      confidence: 0.8,
      keyFactors: this.extractKeyFactors(restrictions),
      nextSteps: this.generateNextSteps(riskLevel, hasCloseMaterials, restrictions)
    };
  }

  private calculateAlternativeLocation(
    original: { lat: number; lng: number }, 
    distance: number, 
    reason: string
  ): { lat: number; lng: number; reason: string; distance: number } {
    const newLng = original.lng + (distance / 111000);
    return {
      lat: original.lat,
      lng: this.sanitizeCoordinate(newLng, 'lng'),
      reason,
      distance
    };
  }

  private generateSummary(restrictions: string[], hasCloseMaterials: boolean): string {
    if (restrictions.length === 0 && hasCloseMaterials) {
      return 'Favorable construction site with excellent material access and no major restrictions';
    } else if (restrictions.length > 0 && !hasCloseMaterials) {
      return 'Challenging site with multiple constraints and limited material access';
    } else if (restrictions.length > 0) {
      return 'Site has regulatory considerations but good material accessibility';
    } else {
      return 'Generally suitable site with potential material transportation considerations';
    }
  }

  private extractKeyFactors(restrictions: string[]): string[] {
    const factors = new Set<string>();
    
    restrictions.forEach(restriction => {
      if (restriction.includes('Protected Area')) factors.add('Environmental conservation');
      if (restriction.includes('Water Body')) factors.add('Water resource management');
      if (restriction.includes('Airport')) factors.add('Aviation safety regulations');
      if (restriction.includes('Transportation')) factors.add('Infrastructure access');
    });
    
    return Array.from(factors).slice(0, 3);
  }

  private generateNextSteps(riskLevel: string, hasCloseMaterials: boolean, restrictions: string[]): string[] {
    const steps = [];
    
    if (riskLevel === 'high') {
      steps.push('Immediate site relocation recommended');
      steps.push('Consult with NEMA for environmental assessment');
    } else if (riskLevel === 'medium') {
      steps.push('Conduct detailed site feasibility study');
      steps.push('Apply for necessary construction permits');
    }
    
    if (!hasCloseMaterials) {
      steps.push('Develop material logistics and transportation plan');
    }
    
    if (restrictions.some(r => r.includes('Water Body'))) {
      steps.push('Conduct water resource impact assessment');
    }
    
    if (restrictions.some(r => r.includes('Protected Area'))) {
      steps.push('Coordinate with Kenya Wildlife Service');
    }
    
    steps.push('Review with qualified construction engineer');
    
    return steps.slice(0, 3);
  }

  // Test the new V2 API
  async testAPIKey(): Promise<boolean> {
    try {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json'
      });

      const testBody = {
        model: 'command-a-03-2025',
        messages: [
          {
            role: 'user',
            content: 'Respond with "OK" if the V2 API is working.'
          }
        ],
        max_tokens: 10
      };

      const response: any = await this.http.post(this.API_URL, testBody, { headers }).toPromise();
      console.log('✅ Cohere V2 API test successful');
      return true;
    } catch (error) {
      console.error('❌ Cohere V2 API test failed:', error);
      return false;
    }
  }
}