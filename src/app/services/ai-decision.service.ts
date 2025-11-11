// ai-recommendation.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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
export class AIRecommendationService {
  private http = inject(HttpClient);

  private readonly OLLAMA_URL = 'http://localhost:11434/api/generate';
  private readonly CONTEXT_WINDOW = 4000; // characters

  async generateRecommendations(context: SiteContext): Promise<AIRecommendation> {
    const prompt = this.buildAnalysisPrompt(context);
    
    try {
      // Try Ollama first (local, free)
      return await this.callOllama(prompt);
    } catch (error) {
      console.warn('Ollama failed, using rule-based fallback:', error);
      return this.ruleBasedFallback(context);
    }
  }

  private buildAnalysisPrompt(context: SiteContext): string {
    const { selectedSite, nearestMaterials, restrictions, analysisResult } = context;

    return `You are a construction site planning expert in Kenya. Analyze this site and provide specific, actionable recommendations.

SITE CONTEXT:
📍 Location: ${selectedSite.lat.toFixed(4)}, ${selectedSite.lng.toFixed(4)}

🚫 RESTRICTIONS:
${restrictions.length > 0 ? restrictions.map(r => `• ${r}`).join('\n') : '• No major restrictions detected'}

🏗️ NEAREST MATERIALS (within 50km):
${nearestMaterials.slice(0, 5).map(m => 
  `• ${m.material.name} - ${m.distance}m away (${m.travelTime} min travel)`
).join('\n')}

SITE SUITABILITY: ${analysisResult?.isValid ? '✅ Generally Suitable' : '❌ Has Issues'}

ANALYSIS REQUEST:
Provide a CONCISE analysis with:
1. One-sentence summary
2. Specific relocation recommendation if needed (with coordinates and reason)
3. Risk level assessment
4. Key factors considered
5. Concrete next steps

Respond in this JSON format only:
{
  "summary": "Brief overall assessment",
  "recommendation": "Specific actionable advice",
  "alternativeLocation": {
    "lat": 12.3456,
    "lng": 34.5678,
    "reason": "Why this location is better",
    "distance": 1500
  },
  "riskLevel": "low|medium|high",
  "confidence": 0.85,
  "keyFactors": ["factor1", "factor2", "factor3"],
  "nextSteps": ["step1", "step2", "step3"]
}

Focus on:
- Regulatory compliance
- Material accessibility
- Environmental impact
- Cost optimization
- Practical construction feasibility`;
  }

  private async callOllama(prompt: string): Promise<AIRecommendation> {
    const response = await fetch(this.OLLAMA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama2', // or 'mistral', 'gemma'
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseAIResponse(data.response);
  }

  private parseAIResponse(aiText: string): AIRecommendation {
    try {
      // Extract JSON from the response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateAIResponse(parsed);
      }
      throw new Error('No JSON found in response');
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error('AI response parsing failed');
    }
  }

  private validateAIResponse(response: any): AIRecommendation {
    // Basic validation and sanitization
    return {
      summary: response.summary || 'Analysis completed',
      recommendation: response.recommendation || 'Consider further assessment',
      alternativeLocation: response.alternativeLocation ? {
        lat: Math.max(-4.0, Math.min(4.0, response.alternativeLocation.lat)), // Kenya bounds
        lng: Math.max(33.0, Math.min(42.0, response.alternativeLocation.lng)),
        reason: response.alternativeLocation.reason || 'Better accessibility',
        distance: response.alternativeLocation.distance || 1000
      } : undefined,
      riskLevel: ['low', 'medium', 'high'].includes(response.riskLevel) ? response.riskLevel : 'medium',
      confidence: Math.min(1, Math.max(0, response.confidence || 0.7)),
      keyFactors: Array.isArray(response.keyFactors) ? response.keyFactors.slice(0, 5) : ['Regulatory compliance', 'Material access'],
      nextSteps: Array.isArray(response.nextSteps) ? response.nextSteps.slice(0, 3) : ['Conduct site visit']
    };
  }

  private ruleBasedFallback(context: SiteContext): AIRecommendation {
    const { selectedSite, nearestMaterials, restrictions } = context;
    
    // Smart rule-based analysis
    const hasProtectedArea = restrictions.some(r => r.includes('Protected Area') || r.includes('National Park'));
    const hasWaterBody = restrictions.some(r => r.includes('Water Body'));
    const hasAirport = restrictions.some(r => r.includes('Airport'));
    
    const closestMaterial = nearestMaterials[0];
    const hasCloseMaterials = closestMaterial && closestMaterial.distance < 5000;

    let recommendation = '';
    let alternativeLocation = undefined;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    if (hasProtectedArea) {
      recommendation = `Site within protected area. Relocate at least 2km away from boundary.`;
      riskLevel = 'high';
      alternativeLocation = this.calculateAlternativeLocation(selectedSite, 2000, 'Away from protected area');
    } else if (hasWaterBody) {
      recommendation = `Near water body - consider flood risks and environmental permits.`;
      riskLevel = 'medium';
      alternativeLocation = this.calculateAlternativeLocation(selectedSite, 500, 'Higher ground away from water');
    } else if (!hasCloseMaterials) {
      recommendation = `No nearby materials. Consider importing or alternative construction methods.`;
      riskLevel = 'medium';
    } else {
      recommendation = `Site appears suitable. Proceed with standard approvals.`;
      riskLevel = 'low';
    }

    return {
      summary: this.generateSummary(restrictions, hasCloseMaterials),
      recommendation,
      alternativeLocation,
      riskLevel,
      confidence: 0.8,
      keyFactors: this.extractKeyFactors(restrictions),
      nextSteps: this.generateNextSteps(riskLevel, hasCloseMaterials)
    };
  }

  private calculateAlternativeLocation(
    original: { lat: number; lng: number }, 
    distance: number, 
    reason: string
  ): { lat: number; lng: number; reason: string; distance: number } {
    // Simple displacement (east direction as default)
    const newLng = original.lng + (distance / 111000); // approx meters to degrees
    return {
      lat: original.lat,
      lng: newLng,
      reason,
      distance
    };
  }

  private generateSummary(restrictions: string[], hasCloseMaterials: boolean): string {
    if (restrictions.length === 0 && hasCloseMaterials) {
      return 'Favorable site with good material access';
    } else if (restrictions.length > 0 && !hasCloseMaterials) {
      return 'Challenging site with multiple constraints';
    } else if (restrictions.length > 0) {
      return 'Site has restrictions but material access is good';
    } else {
      return 'Site suitable but consider material transportation';
    }
  }

  private extractKeyFactors(restrictions: string[]): string[] {
    const factors = new Set<string>();
    
    restrictions.forEach(restriction => {
      if (restriction.includes('Protected Area')) factors.add('Environmental conservation');
      if (restriction.includes('Water Body')) factors.add('Water resource management');
      if (restriction.includes('Airport')) factors.add('Aviation safety');
      if (restriction.includes('Transportation')) factors.add('Infrastructure access');
    });
    
    return Array.from(factors).slice(0, 3);
  }

  private generateNextSteps(riskLevel: string, hasCloseMaterials: boolean): string[] {
    const steps = [];
    
    if (riskLevel === 'high') {
      steps.push('Immediate relocation recommended');
      steps.push('Consult with environmental authority');
    } else if (riskLevel === 'medium') {
      steps.push('Conduct detailed site assessment');
      steps.push('Apply for necessary permits');
    }
    
    if (!hasCloseMaterials) {
      steps.push('Develop material transportation plan');
    }
    
    steps.push('Review with construction team');
    
    return steps.slice(0, 3);
  }
}