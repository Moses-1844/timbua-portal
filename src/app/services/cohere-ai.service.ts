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
  terrainAnalysis?: any;
  infrastructure?: any;
}

export interface AIRecommendation {
  summary: string;
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  keyFactors: string[];
  nextSteps: string[];
  regulatoryRequirements?: string[];
  estimatedCostImpact?: string;
  terrainConsiderations?: string[];
  infrastructureAssessment?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CohereAIService {
  private http = inject(HttpClient);
  
  private readonly API_KEY = 'zU0IsKLMQLR2Lx333Bt00hLPj5ng4EY48TI0DIYm';
  private readonly API_URL = 'https://api.cohere.ai/v2/chat';

  async generateRecommendations(context: SiteContext): Promise<AIRecommendation> {
    try {
      const requestBody = this.buildChatRequest(context);
      
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json',
      });

      console.log('🤖 Sending request to Cohere V2 API...');
      
      const response: any = await this.http.post(this.API_URL, requestBody, { headers })
        .pipe(
          catchError((error: HttpErrorResponse) => {
            console.error('❌ Cohere V2 API Error:', error);
            if (error.status === 401) {
              throw new Error('Invalid API key');
            } else if (error.status === 429) {
              throw new Error('Rate limit exceeded');
            } else {
              throw new Error(`API error: ${error.status}`);
            }
          })
        )
        .toPromise();

      console.log('✅ Cohere V2 API Response received');
      
      if (response?.message?.content?.[0]?.text) {
        return this.parseAIResponse(response.message.content[0].text, context);
      } else if (response?.text) {
        return this.parseAIResponse(response.text, context);
      } else {
        console.warn('Unexpected response structure, using fallback');
        return this.enhancedRuleBasedFallback(context);
      }
    } catch (error) {
      console.error('Cohere AI API error, using fallback:', error);
      return this.enhancedRuleBasedFallback(context);
    }
  }

  private buildChatRequest(context: SiteContext): any {
    const { selectedSite, nearestMaterials, restrictions, terrainAnalysis, infrastructure, analysisResult } = context;

    const systemMessage = `You are a construction site assessment expert in Kenya. Analyze potential construction sites and provide specific, actionable recommendations.

Always respond with valid JSON in this exact format:
{
  "summary": "Brief overall assessment",
  "recommendation": "Specific actionable advice",
  "riskLevel": "low|medium|high",
  "confidence": 0.85,
  "keyFactors": ["factor1", "factor2", "factor3"],
  "nextSteps": ["step1", "step2", "step3"],
  "regulatoryRequirements": ["req1", "req2"],
  "estimatedCostImpact": "Cost implications",
  "terrainConsiderations": ["terrain1", "terrain2"],
  "infrastructureAssessment": ["infra1", "infra2"]
}

Focus on Kenyan regulations, material accessibility, terrain conditions, and infrastructure availability.`;

    const userMessage = `
CONSTRUCTION SITE ANALYSIS REQUEST:

📍 LOCATION: ${selectedSite.lat.toFixed(4)}, ${selectedSite.lng.toFixed(4)}
📊 SITE SCORE: ${analysisResult?.overallScore || 'N/A'}/100

🚫 RESTRICTIONS & CONSTRAINTS:
${restrictions.length > 0 ? restrictions.map(r => `• ${r}`).join('\n') : '• No major restrictions detected'}

🏞️ TERRAIN ANALYSIS:
• Elevation: ${terrainAnalysis?.elevation || 'Unknown'} meters
• Slope: ${terrainAnalysis?.slope || 'Unknown'}% gradient
• Soil Type: ${terrainAnalysis?.soilType || 'Unknown'}
• Drainage: ${terrainAnalysis?.drainage || 'Unknown'}
• Flood Risk: ${terrainAnalysis?.floodRisk || 'Unknown'}
• Accessibility: ${terrainAnalysis?.accessibility || 'Unknown'}

🛣️ INFRASTRUCTURE ASSESSMENT:
• Road Access: ${infrastructure?.roads?.distance ? Math.round(infrastructure.roads.distance) + 'm' : 'Unknown'} (${infrastructure?.roads?.quality || 'Unknown'} quality)
• Utilities - Water: ${infrastructure?.utilities?.water ? 'Available' : 'Not available'}, Electricity: ${infrastructure?.utilities?.electricity ? 'Available' : 'Not available'}
• Proximity to Town: ${infrastructure?.proximityToTown || 'Unknown'} meters
• Public Transport: ${infrastructure?.publicTransport || 'Unknown'}

🏗️ MATERIAL AVAILABILITY:
${nearestMaterials.slice(0, 4).map(m => 
  `• ${m.material.name} (${m.material.type?.join(', ') || 'construction material'}) - ${Math.round(m.distance)}m away - ${m.travelTime} min travel`
).join('\n')}

KENYAN REGULATORY CONTEXT:
- NEMA environmental approval required
- County government building permits
- Water Act 2016 compliance for water bodies
- Environmental Impact Assessment for sensitive areas

Please provide a comprehensive site assessment focusing on terrain suitability, infrastructure adequacy, and regulatory compliance.`;

    return {
      model: 'command-a-03-2025',
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
      max_tokens: 1500,
    };
  }

  private parseAIResponse(aiText: string, context: SiteContext): AIRecommendation {
    try {
      console.log('🤖 Raw AI Response:', aiText);
      
      const cleanedText = aiText.replace(/```json\n?|\n?```/g, '').trim();
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateAIResponse(parsed, context);
      } else {
        console.warn('No JSON found in AI response, using fallback');
        return this.enhancedRuleBasedFallback(context);
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.enhancedRuleBasedFallback(context);
    }
  }

  private validateAIResponse(response: any, context: SiteContext): AIRecommendation {
    const { restrictions } = context;
    
    // Critical overrides for prohibited sites
    const isInWaterBody = restrictions.some(r => r.includes('Water Body') && r.includes('INSIDE'));
    const hasProtectedArea = restrictions.some(r => r.includes('Protected Area') || r.includes('National Park'));

    let recommendation = response.recommendation || response.recomendation;
    let riskLevel = response.riskLevel;

    if (isInWaterBody) {
      recommendation = `🚫 STRONGLY REJECTED - Site is INSIDE protected water body. Construction PROHIBITED under Kenyan Water Act 2016. Immediate relocation required.`;
      riskLevel = 'high';
    } else if (hasProtectedArea) {
      recommendation = `🚫 REJECTED - Site within protected area boundary. Construction prohibited under Kenyan wildlife conservation laws.`;
      riskLevel = 'high';
    }

    return {
      summary: response.summary || 'Comprehensive site analysis completed',
      recommendation: recommendation || 'Consider professional site assessment with terrain and infrastructure evaluation',
      riskLevel: ['low', 'medium', 'high'].includes(riskLevel) ? riskLevel : 'medium',
      confidence: Math.min(1, Math.max(0, response.confidence || 0.7)),
      keyFactors: Array.isArray(response.keyFactors) ? response.keyFactors.slice(0, 5) : 
        this.generateKeyFactorsFromContext(context),
      nextSteps: Array.isArray(response.nextSteps) ? response.nextSteps.slice(0, 4) : 
        this.generateNextStepsFromContext(context),
      regulatoryRequirements: Array.isArray(response.regulatoryRequirements) ? 
        response.regulatoryRequirements : this.generateRegulatoryRequirements(context),
      estimatedCostImpact: response.estimatedCostImpact || this.estimateCostImpact(context),
      terrainConsiderations: Array.isArray(response.terrainConsiderations) ? 
        response.terrainConsiderations : this.generateTerrainConsiderations(context),
      infrastructureAssessment: Array.isArray(response.infrastructureAssessment) ? 
        response.infrastructureAssessment : this.generateInfrastructureAssessment(context)
    };
  }

  // Enhanced fallback with terrain and infrastructure analysis
  private enhancedRuleBasedFallback(context: SiteContext): AIRecommendation {
    const { selectedSite, nearestMaterials, restrictions, terrainAnalysis, infrastructure, analysisResult } = context;
    
    const isInWaterBody = restrictions.some(r => r.includes('Water Body') && r.includes('INSIDE'));
    const isNearWaterBody = restrictions.some(r => r.includes('Water Body') && r.includes('within'));
    const hasProtectedArea = restrictions.some(r => r.includes('Protected Area') || r.includes('National Park'));
    const hasAirport = restrictions.some(r => r.includes('Airport'));
    const hasForest = restrictions.some(r => r.includes('Forest Reserve'));
    
    const closestMaterial = nearestMaterials[0];
    const hasCloseMaterials = closestMaterial && closestMaterial.distance < 5000;
    const hasGoodRoadAccess = infrastructure?.roads?.distance < 2000;
    const hasUtilities = infrastructure?.utilities?.water || infrastructure?.utilities?.electricity;
    const siteScore = analysisResult?.overallScore || 0;

    let recommendation = '';
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    let confidence = 0.85;

    // Critical restrictions (highest priority)
    if (isInWaterBody) {
      recommendation = `🚫 STRONGLY REJECTED - Site is INSIDE protected water body. Construction PROHIBITED under Kenyan Water Act 2016. Immediate relocation required to avoid legal penalties and environmental damage.`;
      riskLevel = 'high';
      confidence = 0.95;
    } 
    else if (hasProtectedArea) {
      recommendation = `🚫 REJECTED - Site within protected area boundary. Construction prohibited under Kenyan Wildlife Conservation and Management Act. Requires immediate relocation.`;
      riskLevel = 'high';
      confidence = 0.90;
    }
    else if (hasForest) {
      recommendation = `🚫 REJECTED - Site in forest reserve. Protected under Kenyan Forest Act 2005. Requires special license from Kenya Forest Service (rarely granted).`;
      riskLevel = 'high';
      confidence = 0.90;
    }
    else if (isNearWaterBody) {
      recommendation = `⚠️ HIGHLY DISCOURAGED - Site within water body buffer zone. Requires complex NEMA and WARMA approvals with high risk of denial. Extensive environmental impact assessment needed.`;
      riskLevel = 'high';
      confidence = 0.85;
    }
    else if (hasAirport) {
      recommendation = `⚠️ RESTRICTED - Airport proximity imposes strict height limitations (typically 15m max) and requires KCAA clearance. Aviation safety regulations must be strictly followed.`;
      riskLevel = 'medium';
      confidence = 0.80;
    }
    // Terrain-based assessments
    else if (terrainAnalysis?.floodRisk === 'high') {
      recommendation = `⚠️ HIGH FLOOD RISK - Site located in high flood risk area. Requires specialized foundation design, comprehensive drainage systems, and county hydrological approval. Additional 20-30% construction cost expected for flood mitigation.`;
      riskLevel = 'high';
      confidence = 0.80;
    }
    else if (terrainAnalysis?.slope > 15) {
      recommendation = `⚠️ STEEP TERRAIN - Significant slope (${terrainAnalysis.slope}%) requires extensive terracing, retaining walls, and specialized foundations. Consult geotechnical engineer. 25-40% additional site development costs expected.`;
      riskLevel = 'medium';
      confidence = 0.75;
    }
    else if (terrainAnalysis?.slope > 8) {
      recommendation = `⚠️ MODERATE SLOPE - Site has ${terrainAnalysis.slope}% gradient requiring careful site planning and potential terracing. Additional 10-15% site development costs.`;
      riskLevel = 'medium';
      confidence = 0.70;
    }
    else if (terrainAnalysis?.drainage === 'poor') {
      recommendation = `⚠️ DRAINAGE CONCERNS - Poor natural drainage identified. Requires comprehensive drainage system design and potential soil amendment. Additional 5-10% infrastructure costs.`;
      riskLevel = 'medium';
      confidence = 0.75;
    }
    // Infrastructure-based assessments
    else if (!hasGoodRoadAccess) {
      recommendation = `⚠️ ACCESS CHALLENGES - Remote location (${infrastructure?.roads?.distance || 0}m from quality road). Requires access road construction and improved logistics planning. Additional 10-20% infrastructure costs.`;
      riskLevel = 'medium';
      confidence = 0.70;
    }
    else if (!hasUtilities) {
      recommendation = `🛠️ UTILITY PLANNING REQUIRED - Site lacks municipal utilities. Independent water (borehole) and power (solar/generator) solutions needed. Additional KES 300K-700K for utility setup.`;
      riskLevel = 'medium';
      confidence = 0.75;
    }
    else if (!hasCloseMaterials) {
      recommendation = `📦 MATERIAL LOGISTICS - Limited material access (nearest source: ${closestMaterial?.distance || 0}m). May increase construction costs by 15-25%. Consider material import logistics or alternative construction methods.`;
      riskLevel = 'medium';
      confidence = 0.75;
    }
    // Score-based recommendations
    else if (siteScore >= 80) {
      recommendation = `✅ EXCELLENT SITE - High suitability score (${siteScore}/100). Optimal conditions with good terrain, infrastructure, and material access. Proceed with standard construction approval process.`;
      riskLevel = 'low';
      confidence = 0.85;
    }
    else if (siteScore >= 60) {
      recommendation = `✅ SUITABLE SITE - Good conditions (${siteScore}/100) with manageable constraints. Favorable terrain and adequate infrastructure. Standard construction process recommended.`;
      riskLevel = 'low';
      confidence = 0.80;
    }
    else if (siteScore >= 40) {
      recommendation = `⚠️ MODERATE SITE - Some challenges present (${siteScore}/100). Requires careful planning for terrain and infrastructure considerations. Additional approvals may be needed.`;
      riskLevel = 'medium';
      confidence = 0.75;
    }
    else {
      recommendation = `✅ GENERALLY SUITABLE - Site conditions acceptable with standard terrain and infrastructure. Proceed with Kenyan construction approval process including NEMA and county approvals.`;
      riskLevel = 'low';
      confidence = 0.80;
    }

    return {
      summary: this.generateEnhancedSummary(context),
      recommendation,
      riskLevel,
      confidence,
      keyFactors: this.generateKeyFactorsFromContext(context),
      nextSteps: this.generateNextStepsFromContext(context),
      regulatoryRequirements: this.generateRegulatoryRequirements(context),
      estimatedCostImpact: this.estimateCostImpact(context),
      terrainConsiderations: this.generateTerrainConsiderations(context),
      infrastructureAssessment: this.generateInfrastructureAssessment(context)
    };
  }

  private generateEnhancedSummary(context: SiteContext): string {
    const { restrictions, terrainAnalysis, infrastructure, analysisResult } = context;
    const score = analysisResult?.overallScore || 0;
    
    if (restrictions.some(r => r.includes('INSIDE'))) {
      return '🚫 CRITICAL: Site in prohibited area - IMMEDIATE RELOCATION REQUIRED';
    } 
    else if (restrictions.some(r => r.includes('Protected Area') || r.includes('Forest Reserve'))) {
      return '🚫 PROHIBITED: Protected area - construction not permitted';
    }
    else if (restrictions.some(r => r.includes('Water Body') && r.includes('within'))) {
      return '⚠️ HIGH RISK: Water body buffer zone - complex approvals needed';
    }
    else if (terrainAnalysis?.floodRisk === 'high') {
      return '⚠️ FLOOD RISK: High flood risk area requiring significant mitigation';
    }
    else if (terrainAnalysis?.slope > 15) {
      return '⚠️ STEEP TERRAIN: Challenging slope conditions requiring engineering solutions';
    }
    else if (infrastructure?.roads?.distance > 3000) {
      return '🛣️ REMOTE ACCESS: Limited road infrastructure affecting logistics';
    }
    else if (score >= 80) return '✅ EXCELLENT: Highly suitable site with optimal conditions';
    else if (score >= 60) return '✅ GOOD: Suitable site with favorable conditions';
    else if (score >= 40) return '⚠️ MODERATE: Site requires careful planning and additional considerations';
    else return '📝 ASSESSMENT NEEDED: Professional evaluation recommended for specific constraints';
  }

  private generateKeyFactorsFromContext(context: SiteContext): string[] {
    const factors = new Set<string>();
    const { restrictions, terrainAnalysis, infrastructure, nearestMaterials } = context;

    // Critical restriction factors
    if (restrictions.some(r => r.includes('Water Body') && r.includes('INSIDE'))) {
      factors.add('🚫 PROHIBITED: Construction in water bodies illegal (Water Act 2016)');
    }
    if (restrictions.some(r => r.includes('Protected Area'))) {
      factors.add('🚫 PROHIBITED: Protected area conservation requirements');
    }
    if (restrictions.some(r => r.includes('Forest Reserve'))) {
      factors.add('🚫 PROHIBITED: Forest reserve protection (Forest Act 2005)');
    }

    // Water body proximity
    if (restrictions.some(r => r.includes('Water Body'))) {
      factors.add('⚠️ Water resource protection zone restrictions');
    }

    // Terrain factors
    if (terrainAnalysis?.slope > 15) {
      factors.add(`⚠️ Steep terrain: ${terrainAnalysis.slope}% slope requires special engineering`);
    } else if (terrainAnalysis?.slope > 8) {
      factors.add(`📐 Moderate slope: ${terrainAnalysis.slope}% requires careful planning`);
    }
    
    if (terrainAnalysis?.floodRisk === 'high') {
      factors.add('🌊 High flood risk area - requires mitigation');
    } else if (terrainAnalysis?.floodRisk === 'medium') {
      factors.add('💧 Moderate flood risk - drainage planning needed');
    }
    
    if (terrainAnalysis?.drainage === 'poor') {
      factors.add('💧 Poor natural drainage - drainage systems needed');
    }
    
    if (terrainAnalysis?.soilType) {
      factors.add(`🏗️ Soil type: ${terrainAnalysis.soilType} - foundation considerations`);
    }

    // Infrastructure factors
    if (infrastructure?.roads?.distance > 2000) {
      factors.add(`🛣️ Remote access: ${infrastructure.roads.distance}m from main road`);
    } else if (infrastructure?.roads?.distance > 1000) {
      factors.add(`🛣️ Moderate access: ${infrastructure.roads.distance}m from road`);
    }
    
    if (!infrastructure?.utilities?.water) {
      factors.add('💧 No municipal water - borehole required');
    }
    if (!infrastructure?.utilities?.electricity) {
      factors.add('⚡ No grid electricity - solar/generator needed');
    }

    // Material factors
    const closestMaterial = nearestMaterials[0];
    if (closestMaterial) {
      if (closestMaterial.distance > 10000) {
        factors.add('🚚 Very limited material access - high transport costs');
      } else if (closestMaterial.distance > 5000) {
        factors.add('🚛 Limited material access - consider logistics');
      } else {
        factors.add(`✅ Good material access: ${closestMaterial.material.name} ${closestMaterial.distance}m away`);
      }
    }

    // Regulatory factors
    if (restrictions.some(r => r.includes('Airport'))) {
      factors.add('✈️ Aviation safety height restrictions apply');
    }

    return Array.from(factors).slice(0, 6);
  }

  private generateNextStepsFromContext(context: SiteContext): string[] {
    const steps = [];
    const { restrictions, terrainAnalysis, infrastructure } = context;

    // Critical steps for prohibited sites
    if (restrictions.some(r => r.includes('INSIDE'))) {
      steps.push('🚨 IMMEDIATE: Abandon site and identify alternative location');
      steps.push('📋 CONSULTATION: Engage environmental consultant for suitable alternatives');
      return steps;
    }

    // Regulatory steps
    if (restrictions.length > 0) {
      steps.push('📝 REGULATORY: Apply for NEMA project registration and EIA study');
    }

    // County government steps
    steps.push('🏛️ COUNTY: Submit development application to local county government');
    steps.push('📐 PROFESSIONAL: Engage registered architect/engineer for compliant designs');

    // Terrain-specific steps
    if (terrainAnalysis?.floodRisk === 'high') {
      steps.push('🌊 HYDROLOGY: Commission detailed flood risk assessment');
    }
    if (terrainAnalysis?.slope > 8) {
      steps.push('🏔️ ENGINEERING: Consult geotechnical engineer for slope stability analysis');
    }
    if (terrainAnalysis?.drainage === 'poor') {
      steps.push('💧 DRAINAGE: Design comprehensive drainage system');
    }

    // Infrastructure steps
    if (!infrastructure?.utilities?.water) {
      steps.push('💧 WATER: Arrange for borehole drilling and water testing');
    }
    if (!infrastructure?.utilities?.electricity) {
      steps.push('⚡ POWER: Plan for solar or generator power solution');
    }
    if (infrastructure?.roads?.distance > 1000) {
      steps.push('🛣️ ACCESS: Plan and budget for access road construction');
    }

    // Standard steps
    steps.push('📏 SURVEY: Conduct detailed site survey with registered surveyor');
    steps.push('💰 BUDGET: Prepare detailed cost estimate including all approvals');

    return steps.slice(0, 5);
  }

  private generateRegulatoryRequirements(context: SiteContext): string[] {
    const requirements = [
      'NEMA EIA License or Project Report',
      'County Government Building Permit',
      'Land Use Change Consent (if applicable)',
      'NCA Registration (for projects > KES 10M)'
    ];

    const { restrictions } = context;

    if (restrictions.some(r => r.includes('Water Body'))) {
      requirements.push('WARMA Water Use Permit');
      requirements.push('NEMA Water Quality Monitoring Plan');
    }
    if (restrictions.some(r => r.includes('Protected Area'))) {
      requirements.push('Kenya Wildlife Service Clearance');
    }
    if (restrictions.some(r => r.includes('Forest Reserve'))) {
      requirements.push('Kenya Forest Service License');
    }
    if (restrictions.some(r => r.includes('Airport'))) {
      requirements.push('Kenya Civil Aviation Authority Height Clearance');
    }

    return requirements.slice(0, 6);
  }

  private generateTerrainConsiderations(context: SiteContext): string[] {
    const considerations = [];
    const { terrainAnalysis } = context;

    if (terrainAnalysis?.elevation) {
      considerations.push(`Elevation: ${terrainAnalysis.elevation} meters above sea level`);
    }
    if (terrainAnalysis?.slope) {
      considerations.push(`Slope gradient: ${terrainAnalysis.slope}% - ${this.getSlopeDescription(terrainAnalysis.slope)}`);
    }
    if (terrainAnalysis?.soilType) {
      considerations.push(`Soil type: ${terrainAnalysis.soilType} - ${this.getSoilImplications(terrainAnalysis.soilType)}`);
    }
    if (terrainAnalysis?.drainage) {
      considerations.push(`Drainage: ${terrainAnalysis.drainage} - ${this.getDrainageImplications(terrainAnalysis.drainage)}`);
    }
    if (terrainAnalysis?.floodRisk) {
      considerations.push(`Flood risk: ${terrainAnalysis.floodRisk} - ${this.getFloodRiskImplications(terrainAnalysis.floodRisk)}`);
    }
    if (terrainAnalysis?.accessibility) {
      considerations.push(`Site accessibility: ${terrainAnalysis.accessibility}`);
    }

    return considerations.length > 0 ? considerations : ['Standard terrain conditions - no major concerns'];
  }

  private generateInfrastructureAssessment(context: SiteContext): string[] {
    const assessment = [];
    const { infrastructure } = context;

    if (infrastructure?.roads) {
      const distance = infrastructure.roads.distance;
      const quality = infrastructure.roads.quality || 'standard';
      if (distance > 2000) {
        assessment.push(`Road access: Limited (${Math.round(distance)}m) - access road construction needed`);
      } else if (distance > 1000) {
        assessment.push(`Road access: Moderate (${Math.round(distance)}m) - ${quality} quality`);
      } else {
        assessment.push(`Road access: Good (${Math.round(distance)}m) - ${quality} quality`);
      }
    }

    if (infrastructure?.utilities) {
      const utils = [];
      if (infrastructure.utilities.water) utils.push('municipal water');
      if (infrastructure.utilities.electricity) utils.push('grid electricity');
      
      if (utils.length > 0) {
        assessment.push(`Utilities: ${utils.join(' and ')} available`);
      } else {
        assessment.push('Utilities: No municipal services - independent solutions required');
      }
    }

    if (infrastructure?.proximityToTown) {
      const proximity = infrastructure.proximityToTown;
      if (proximity > 5000) {
        assessment.push(`Location: Remote (${Math.round(proximity)}m from town)`);
      } else if (proximity > 2000) {
        assessment.push(`Location: Suburban (${Math.round(proximity)}m from town)`);
      } else {
        assessment.push(`Location: Urban (${Math.round(proximity)}m from town)`);
      }
    }

    return assessment.length > 0 ? assessment : ['Standard infrastructure assessment required'];
  }

  private estimateCostImpact(context: SiteContext): string {
    const { terrainAnalysis, infrastructure, nearestMaterials } = context;
    
    // Base construction cost for standard residential in Kenya
    let baseCost = 'KES 3-5M for standard construction';
    let additionalCosts: string[] = [];
    let warnings: string[] = [];

    // Critical restrictions - no construction allowed
    if (context.restrictions.some(r => r.includes('INSIDE'))) {
      return 'PROHIBITED: No construction allowed. Site abandonment required. Potential fines: KES 1-5M';
    }

    // Terrain cost impacts
    if (terrainAnalysis?.slope > 15) {
      additionalCosts.push('KES 800K-1.5M for site grading and retaining walls');
    } else if (terrainAnalysis?.slope > 8) {
      additionalCosts.push('KES 400K-800K for site preparation');
    }
    
    if (terrainAnalysis?.floodRisk === 'high') {
      additionalCosts.push('KES 500K-1M for flood protection and drainage');
      warnings.push('High flood risk may affect insurance premiums');
    }
    
    if (terrainAnalysis?.drainage === 'poor') {
      additionalCosts.push('KES 200K-500K for drainage systems');
    }

    // Infrastructure costs
    if (infrastructure?.roads?.distance > 2000) {
      additionalCosts.push('KES 300K-700K for access road construction');
    } else if (infrastructure?.roads?.distance > 1000) {
      additionalCosts.push('KES 100K-300K for access improvements');
    }
    
    if (!infrastructure?.utilities?.water) {
      additionalCosts.push('KES 200K-500K for borehole and water system');
    }
    
    if (!infrastructure?.utilities?.electricity) {
      additionalCosts.push('KES 150K-400K for solar power system');
    }

    // Material transport costs
    const closestMaterial = nearestMaterials[0];
    if (closestMaterial?.distance > 10000) {
      additionalCosts.push('KES 300K-600K for material transport');
    } else if (closestMaterial?.distance > 5000) {
      additionalCosts.push('KES 100K-300K for material transport');
    }

    let result = baseCost;
    if (additionalCosts.length > 0) {
      result += ` + Additional: ${additionalCosts.join(', ')}`;
    }
    if (warnings.length > 0) {
      result += ` | Note: ${warnings.join(', ')}`;
    }

    return result;
  }

  // Helper methods for terrain descriptions
  private getSlopeDescription(slope: number): string {
    if (slope > 15) return 'Steep - requires significant engineering';
    if (slope > 8) return 'Moderate - requires careful planning';
    if (slope > 3) return 'Gentle - minimal impact';
    return 'Flat - ideal for construction';
  }

  private getSoilImplications(soilType: string): string {
    const implications: {[key: string]: string} = {
      'clay': 'Good bearing capacity but poor drainage',
      'sand': 'Good drainage but may require stabilization',
      'loam': 'Ideal for construction - good balance',
      'rock': 'Excellent foundation but difficult excavation',
      'gravel': 'Good drainage and stability'
    };
    return implications[soilType.toLowerCase()] || 'Standard foundation requirements';
  }

  private getDrainageImplications(drainage: string): string {
    const implications: {[key: string]: string} = {
      'excellent': 'Natural drainage adequate',
      'good': 'Minor drainage improvements needed',
      'poor': 'Comprehensive drainage system required',
      'very poor': 'Major drainage engineering needed'
    };
    return implications[drainage.toLowerCase()] || 'Standard drainage assessment needed';
  }

  private getFloodRiskImplications(floodRisk: string): string {
    const implications: {[key: string]: string} = {
      'high': 'Significant flood mitigation required',
      'medium': 'Moderate flood protection needed',
      'low': 'Standard flood precautions',
      'very low': 'Minimal flood concerns'
    };
    return implications[floodRisk.toLowerCase()] || 'Standard flood assessment recommended';
  }

  // Test the API
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